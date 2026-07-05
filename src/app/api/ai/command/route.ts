import { NextResponse, type NextRequest } from "next/server";

import { runPartnerCommand, streamPartnerCommand } from "@/lib/ai/partner";
import { isCommand } from "@/lib/ai/provider";
import { readBibleForWorkMentioned } from "@/lib/db/bible";
import { getPieceById } from "@/lib/db/pieces";
import { getActiveWritingFork } from "@/lib/db/user-settings";
import { resolveGenerationVoice } from "@/lib/db/voice-resolve";
import { getWriterVoice } from "@/lib/db/voice-profile";
import { reportError } from "@/lib/observability/report-error";
import { rateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// np_pieces.id is a uuid ... shape-guard before a lookup so a malformed id is a
// clean skip (no bible) rather than a thrown 22P02.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // a partner turn is a real llm call ... a per-user window keeps a mashed
  // send (or a script) from running up the bill. the cheaper ai routes (xray,
  // voice/ask) already guard at 12/min; the partner gets more room at 30.
  const limit = rateLimit(`command:${user.id}`, 30, 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "easy ... give nova a second" },
      { status: 429, headers: { "retry-after": String(Math.ceil(limit.retryAfterMs / 1000)) } },
    );
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
    pieceId: rawPieceId,
  } = (body ?? {}) as {
    command?: unknown;
    context?: unknown;
    stream?: unknown;
    history?: unknown;
    document?: unknown;
    pieceId?: unknown;
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
  // the active writing fork (if any) re-aims the SOURCE to a named strand's
  // snapshot ... null = your live voice, byte-identical to before.
  const activeFork = await getActiveWritingFork(supabase, user.id);
  const voice = await getWriterVoice(supabase, user.id, activeFork);

  // resolve the piece once ... its work grounds BOTH the bible + the active voice.
  // getPieceById is RLS-gated (owner-scoped) but CAN throw on a db error, so it's
  // guarded; a malformed / not-owned / missing id just leaves the work null.
  let pieceWorkId: string | null = null;
  try {
    if (typeof rawPieceId === "string" && UUID_RE.test(rawPieceId)) {
      const piece = await getPieceById(supabase, rawPieceId);
      pieceWorkId = piece?.work_id ?? null;
    }
  } catch {
    pieceWorkId = null;
  }

  // the world bible, NARROWED to what this line names (retrieval-by-mention): fold
  // only the entities the writer's line + the draft mention into the partner's
  // reserved slot, so a riposte stays in-world. "" for a standalone piece, an empty
  // codex, or a line that names nothing.
  let bible = "";
  try {
    if (pieceWorkId) {
      const mentionSource = `${context}\n\n${pieceDocument ?? ""}`;
      bible = await readBibleForWorkMentioned(supabase, pieceWorkId, mentionSource);
    }
  } catch {
    // the bible is OPTIONAL grounding ... a transient piece-lookup error must
    // degrade to an honest empty slot, never break the riposte (getPieceById
    // throws on a db error, unlike the internally-guarded reads around it).
    bible = "";
  }

  // the active character voice: when this work has a voice selected, overlay it on
  // the writer's base voice (drift-gated) so the riposte speaks in THAT voice, not
  // just the narrator. never throws ... degrades to the base voice.
  const genVoice = await resolveGenerationVoice(supabase, user.id, {
    workId: pieceWorkId,
    base: voice,
  });

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
        voiceCompactView: genVoice.voiceCompactView,
        exemplars: genVoice.exemplars,
        document: pieceDocument,
        bible: bible || undefined,
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
      voiceCompactView: genVoice.voiceCompactView,
      exemplars: genVoice.exemplars,
      document: pieceDocument,
      bible: bible || undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    reportError(err, { tag: "ai-command-failed", command, userId: user.id });
    return NextResponse.json({ error: "nova couldn't reach the model" }, { status: 502 });
  }
}
