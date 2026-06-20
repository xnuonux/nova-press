import "server-only";

/**
 * the mailer ... nova's one send seam, provider-abstracted.
 *
 * dev, test, and preview NEVER send real email: getMailer returns a stub that
 * touches no network and reports stubbed:true, so the dispatch records an honest
 * "stubbed" status and the writer sees exactly what WOULD have gone out while
 * nothing leaves the box. only production, with a resend key AND a verified
 * from-address, returns the real resend-over-fetch mailer (no sdk dependency).
 *
 * the live/stub decision is a pure function over the environment (decideLiveEmail)
 * so it is unit-tested without process.env and a test can never accidentally go
 * live. the resend key is read at call time, never module scope, and this module
 * is "server-only" so it can never reach a client bundle.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  kind: "confirm" | "newsletter";
}

export interface SendResult {
  ok: boolean;
  stubbed: boolean;
  providerId?: string;
  error?: string;
}

export interface Mailer {
  send(msg: EmailMessage): Promise<SendResult>;
}

// a real send waits ~10s for resend, then aborts ... a stalled socket must
// never hang a serverless function and strand a half-sent blast.
const RESEND_TIMEOUT_MS = 10_000;

/**
 * PURE: should nova send REAL email in this environment? gated on an EXPLICIT
 * opt-in flag, NEVER on NODE_ENV ... NODE_ENV is "production" in vercel preview
 * + branch deploys and in `next build && next start`, and the shared eternities
 * resend key is present in every env, so a NODE_ENV gate would blast real
 * subscribers from a preview. NOVA_EMAIL_LIVE is the deliberate prod-only
 * switch; when VERCEL_ENV is present it must also be "production" (belt and
 * braces). still needs a key AND a from-address. injectable env so it is
 * unit-tested without process.env and a test run can never flip live.
 */
export function decideLiveEmail(env: Record<string, string | undefined> = process.env): boolean {
  if (env.NOVA_EMAIL_LIVE !== "true") return false;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== "production") return false;
  return !!env.RESEND_API_KEY && !!env.NOVA_EMAIL_FROM;
}

export function isLiveEmail(): boolean {
  return decideLiveEmail(process.env);
}

// the stub ... dev / test / preview. it never opens a socket. a stubbed:true
// success so the audit log is honest and the writer previews the real thing.
const stubMailer: Mailer = {
  async send(msg: EmailMessage): Promise<SendResult> {
    return { ok: true, stubbed: true, providerId: `stub:${msg.kind}` };
  },
};

// the real one ... prod only, resend over plain fetch. a non-2xx or a thrown
// fetch resolves to ok:false with the reason and NEVER throws, so one bad
// address can't crash a blast mid-flight.
function createResendMailer(apiKey: string, from: string): Mailer {
  return {
    async send(msg: EmailMessage): Promise<SendResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);
      try {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: msg.to,
            subject: msg.subject,
            text: msg.text,
          }),
          signal: controller.signal,
        });
        // 429 / 5xx / any non-2xx is a failure with the reason, never a throw,
        // so one bad address or a rate-limit can't crash a blast mid-flight.
        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return {
            ok: false,
            stubbed: false,
            error: `resend ${res.status} ${detail.slice(0, 200)}`.trim(),
          };
        }
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, stubbed: false, providerId: data.id };
      } catch (err) {
        // an aborted fetch (timeout) lands here too ... name it so the audit log
        // distinguishes a timeout from a network throw.
        const aborted = err instanceof Error && err.name === "AbortError";
        return {
          ok: false,
          stubbed: false,
          error: aborted ? "resend timeout" : err instanceof Error ? err.message : "send failed",
        };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

/**
 * the mailer for this environment. anything but the deliberate prod live-switch
 * -> stub (no network, ever); NOVA_EMAIL_LIVE + key + from on production ->
 * resend. constructed per call ... cheap, and keeps the key out of module scope.
 */
export function getMailer(): Mailer {
  if (!decideLiveEmail(process.env)) return stubMailer;
  // decideLiveEmail guarantees both are present here.
  return createResendMailer(
    process.env.RESEND_API_KEY as string,
    process.env.NOVA_EMAIL_FROM as string,
  );
}
