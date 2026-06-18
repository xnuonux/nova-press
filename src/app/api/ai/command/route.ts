import { NextResponse, type NextRequest } from "next/server";

import { runPartnerCommand, streamPartnerCommand } from "@/lib/ai/partner";
import { isCommand } from "@/lib/ai/provider";
import { getWriterVoice } from "@/lib/db/voice-profile";
import { reportError } from "@/lib/observability/report-error";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// the AI partner command endpoint. auth-gated ... only a logged-in writer
// can spend tokens. validates the command, runs it through the partner
// (provider + voice-mirror prompt + voice-keeper audit), returns json.
// streaming + ghost text arrive with the plate editor integration.
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "not signed in" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  const {
    command,
    context,
    stream,
    history: rawHistory,
    document: rawDocument,
  } = (body ?? {}) as {
    command?: unknown;
    context?: unknown;
    stream?: unknown;
    history?: unknown;
    document?: unknown;
  };
  if (!isCommand(command)) {
    return NextResponse.json({ error: "unknown command" }, { status: 400 });
  }
  if (typeof context !== "string" || context.trim().length === 0) {
    return NextResponse.json({ error: "empty context" }, { status: 400 });
  }
  if (context.length > 8000) {
    return NextResponse.json({ error: "context too long" }, { status: 413 });
  }

  // recent exchange (the rail's conversation memory). bounded hard since it's
  // untrusted client input: known roles only, each turn capped, last 6 turns ...
  // it can't run up the token bill or smuggle in a different shape.
  const history = Array.isArray(rawHistory)
    ? rawHistory
        .filter(
          (h): h is { role: "writer" | "nova"; text: string } =>
            typeof h === "object" &&
            h !== null &&
            ((h as { role?: unknown }).role === "writer" ||
              (h as { role?: unknown }).role === "nova") &&
            typeof (h as { text?: unknown }).text === "string",
        )
        .map((h) => ({ role: h.role, text: h.text.slice(0, 2000) }))
        .slice(-6)
    : [];

  // the draft the rail is sparring over, bounded so a long piece can't run up
  // the bill ... undefined when the rail sends nothing (e.g. a blank canvas).
  const pieceDocument =
    typeof rawDocument === "string" && rawDocument.trim().length > 0
      ? rawDocument.slice(0, 6000)
      : undefined;

  // the writer's distilled voice (compact line + in-voice exemplars), read once
  // and threaded into whichever path runs. {} when the profile isn't trained
  // yet (the prompt keeps its honest fallback), and the read never throws.
  const voice = await getWriterVoice(supabase, user.id);

  // streaming path: powers the conversation rail. the reply streams token by
  // token, dash-safe at the source; the client runs the full voice-keeper at
  // stream end. getPartnerModel throws synchronously on a missing key, so a
  // config failure still lands as a clean 502 before any bytes go out.
  if (stream === true) {
    try {
      const responseStream = streamPartnerCommand({
        command,
        context,
        history,
        voiceCompactView: voice.voiceCompactView,
        exemplars: voice.exemplars,
        document: pieceDocument,
      });
      return new Response(responseStream, {
        headers: {
          "content-type": "text/plain; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch (err) {
      reportError(err, { tag: "ai-command-stream-failed", command, userId: user.id });
      return NextResponse.json({ error: "nova couldn't reach the model" }, { status: 502 });
    }
  }

  try {
    const result = await runPartnerCommand({
      command,
      context,
      voiceCompactView: voice.voiceCompactView,
      exemplars: voice.exemplars,
      document: pieceDocument,
    });
    return NextResponse.json(result);
  } catch (err) {
    reportError(err, { tag: "ai-command-failed", command, userId: user.id });
    return NextResponse.json({ error: "nova couldn't reach the model" }, { status: 502 });
  }
}
