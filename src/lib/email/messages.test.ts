import { describe, expect, it } from "vitest";

import { confirmEmail, terminalPage } from "./messages";

describe("confirmEmail", () => {
  it("carries the confirm url and a subject", () => {
    const m = confirmEmail("https://nova.test/api/subscribe/confirm?token=abc");
    expect(m.subject.length).toBeGreaterThan(0);
    expect(m.text).toContain("https://nova.test/api/subscribe/confirm?token=abc");
  });

  it("stays lowercase and em-dash-free (voice rule)", () => {
    const m = confirmEmail("https://nova.test/x");
    expect(m.subject).toBe(m.subject.toLowerCase());
    expect(m.subject).not.toMatch(/[—–]/);
    expect(m.text).not.toMatch(/[—–]/);
  });
});

describe("terminalPage", () => {
  it("renders the heading + body into an html document", () => {
    const html = terminalPage("you're in", "confirmed ... thanks");
    expect(html).toContain("<!doctype html>");
    // apostrophes in text content are safe and left as-is; the angle-brackets /
    // ampersands / quotes that actually break markup are escaped (next test).
    expect(html).toContain("<h1>you're in</h1>");
    expect(html).toContain("confirmed ... thanks");
    expect(html).toContain('name="robots" content="noindex"');
  });

  it("escapes html in the heading/body so copy can't inject markup", () => {
    const html = terminalPage("<script>x</script>", 'a & b "c"');
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).toContain("a &amp; b &quot;c&quot;");
    expect(html).not.toContain("<script>x</script>");
  });
});
