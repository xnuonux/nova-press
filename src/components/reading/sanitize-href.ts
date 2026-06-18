/**
 * href allowlist for the public reading view. links in a published piece are
 * author-supplied and the reading view is server-rendered for anonymous
 * readers, so a hostile url (javascript:, data:, vbscript:) would be a stored
 * xss vector the moment another reader opens the page. this gate decides which
 * hrefs are safe to emit as a real <a href>.
 *
 * unlike the redirect sanitizer (sanitize-next.ts), which is origin-locked to
 * keep "next" on our own site, article links are allowed to point ANYWHERE on
 * the open web. so the test here is the SCHEME, not the origin: permit only
 * http / https / mailto, reject everything else.
 *
 * the URL constructor does the heavy lifting ... it strips leading control
 * bytes and embedded tabs/newlines while parsing, so "java\tscript:alert(1)"
 * and " javascript:..." both normalize to the javascript: protocol and get
 * rejected. relative hrefs (no scheme) throw and are rejected too: a published
 * piece links out with full urls.
 *
 * the allowed set matches @platejs/link's insert-time allowedSchemes (http,
 * https, mailto, tel) so the editor and the reading view agree ... a link you
 * can make is a link that renders, nothing silently drops to plain text.
 *
 * one extra guard on http(s): a clickable link to localhost or a private/
 * loopback address is never legitimate in a published piece, and pointing
 * readers at their own network is a small csrf footgun. so those hosts are
 * dropped to plain text. this covers the common, typeable cases (localhost,
 * *.local, dotted private/loopback ipv4, ::1) ... it is not a full ssrf
 * defense (exotic encoded ips, ipv6 ula) and isn't meant to be: the scheme
 * gate above is the real xss boundary.
 */

const ALLOWED_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  const dotted = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/);
  if (dotted) {
    const a = Number(dotted[1]);
    const b = Number(dotted[2]);
    if (a === 127 || a === 10 || a === 0) return true; // loopback, private, this-host
    if (a === 192 && b === 168) return true; // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 169 && b === 254) return true; // link-local
  }
  return false;
}

export function isSafeHref(href: unknown): boolean {
  if (typeof href !== "string") return false;
  const trimmed = href.trim();
  if (!trimmed) return false;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return false;
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return false;
  if ((url.protocol === "http:" || url.protocol === "https:") && isPrivateHost(url.hostname)) {
    return false;
  }
  return true;
}
