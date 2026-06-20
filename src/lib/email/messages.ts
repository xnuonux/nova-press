/**
 * email + landing copy ... pure, no deps. the confirmation email body and the
 * tiny terminal pages the confirm / unsubscribe links land on. kept out of the
 * route handlers so the wording is testable and carries nova's voice (lowercase,
 * no em-dashes, "..." for pauses).
 */

export interface ConfirmEmail {
  subject: string;
  text: string;
}

/** the double opt-in email. one job: a single link that earns the click. */
export function confirmEmail(confirmUrl: string): ConfirmEmail {
  return {
    subject: "one tap to confirm",
    text: [
      "you're almost in.",
      "",
      "tap to confirm you want these ... that's the whole ask:",
      confirmUrl,
      "",
      "if this wasn't you, just ignore it ... nothing happens without the tap.",
    ].join("\n"),
  };
}

const SHELL_HEAD = `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>nova press</title>
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:grid; place-items:center;
    background:#0b0b0f; color:#ece9e1;
    font-family: ui-serif, Georgia, "Times New Roman", serif; }
  .card { max-width: 30rem; padding: 3rem 2rem; text-align:center; }
  .dot { display:inline-block; width:7px; height:7px; border-radius:9999px;
    background:#c9a84c; margin-bottom:1.5rem; }
  h1 { font-size:1.6rem; font-weight:500; letter-spacing:-0.01em; margin:0 0 0.75rem; }
  p { font-size:1rem; line-height:1.6; color:#a8a399; margin:0; }
</style></head><body><div class="card"><span class="dot"></span>`;

const SHELL_TAIL = `</div></body></html>`;

/**
 * one terminal page per endpoint, returned for EVERY outcome (acted / already /
 * unknown token) so the landing can never be read as an oracle for whether a
 * token was valid or what state a subscription was in. the caller passes only
 * the single message that endpoint always shows.
 */
export function terminalPage(heading: string, body: string): string {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  return `${SHELL_HEAD}<h1>${esc(heading)}</h1><p>${esc(body)}</p>${SHELL_TAIL}`;
}
