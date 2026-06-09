import { NextResponse, type NextRequest } from "next/server";

import { runPartnerCommand } from "@/lib/ai/partner";
import { isCommand } from "@/lib/ai/provider";
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

  const { command, context } = (body ?? {}) as {
    command?: unknown;
    context?: unknown;
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

  try {
    const result = await runPartnerCommand({ command, context });
    return NextResponse.json(result);
  } catch (err) {
    reportError(err, { tag: "ai-command-failed", command, userId: user.id });
    return NextResponse.json({ error: "nova couldn't reach the model" }, { status: 502 });
  }
}
