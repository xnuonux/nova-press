// nova press · the mythos · the headless typesetter (the impure arm).
//
// takes the pure book html (book.ts + page-css.ts + typography.ts) and sets it
// into real pages: pagedjs runs INSIDE headless chromium (injected as a script,
// auto-run off), then chromium prints the paged result to a pdf buffer. the
// ibm plex serif faces ride along as data-uri @font-face, so the page renders
// its real type everywhere ... including the serverless chromium, which ships
// no fonts at all.
//
// ONE render budget (deliberately under the route's maxDuration): the deadline
// is set when the render starts and every stage ... launch, content load, the
// pagedjs preview, the print ... spends from the same clock. the in-process
// timeout must always win the race against the platform's hard kill, so the
// writer gets the friendly error and the finally gets to close the browser.
//
// chromium is resolved down a chain and the whole thing DEGRADES ... a host
// with no chromium raises TypesetUnavailableError, which the route maps to a
// friendly 503 (never a crash):
//   1. NOVA_CHROMIUM_PATH        ... the explicit override, any host.
//   2. @sparticuz/chromium       ... the serverless linux build (prod).
//   3. playwright's chromium     ... the local dev browser (a devDependency;
//                                    absent in prod, the import just fails).
//   4. a desktop chrome / edge   ... the well-known install paths.
//
// server-only by nature: it touches the filesystem + spawns a browser. every
// heavy dep is imported lazily so building the html stays test-light.

import "server-only";

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join } from "node:path";

/** raised when no chromium can be found or launched on this host ... the route
 *  turns it into a 503 with an honest note, never a stack trace. */
export class TypesetUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TypesetUnavailableError";
  }
}

/** the desktop installs worth trying when nothing better resolved. */
const WELL_KNOWN_PATHS = [
  // windows
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  // mac
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  // linux desktop
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

interface ResolvedChromium {
  executablePath: string;
  args: string[];
}

async function resolveChromium(): Promise<ResolvedChromium | null> {
  const fromEnv = process.env.NOVA_CHROMIUM_PATH;
  if (fromEnv && existsSync(fromEnv)) {
    return { executablePath: fromEnv, args: [] };
  }

  // the serverless build ships its own compressed chromium + the launch args
  // it needs. linux-only by construction; anywhere else the branch is skipped.
  if (process.platform === "linux") {
    try {
      const chromium = (await import("@sparticuz/chromium")).default;
      const p = await chromium.executablePath();
      if (p) return { executablePath: p, args: chromium.args };
    } catch {
      // not installed / not extractable here ... fall through.
    }
  }

  // local dev: playwright is a devDependency and its chromium is already on
  // disk (the e2e browser). in prod the import fails and we fall through.
  try {
    const { chromium } = await import("playwright");
    const p = chromium.executablePath();
    if (p && existsSync(p)) return { executablePath: p, args: [] };
  } catch {
    // playwright absent ... fall through.
  }

  for (const p of WELL_KNOWN_PATHS) {
    if (existsSync(p)) return { executablePath: p, args: [] };
  }
  return null;
}

/**
 * find pagedjs's browser polyfill bundle on disk. its exports map only exposes
 * the package root (the polyfill rides a custom "polyfill" condition, not a
 * subpath), and the server bundler rewrites require.resolve of an external to
 * the bare request string ... so: try a real module resolve and TRUST IT ONLY
 * when it comes back as an absolute path that exists, else fall back to the
 * plain node_modules location under the working directory.
 */
function resolvePagedPolyfill(): string | null {
  try {
    const require = createRequire(import.meta.url);
    const entry = require.resolve("pagedjs");
    if (isAbsolute(entry)) {
      const beside = join(dirname(entry), "..", "dist", "paged.polyfill.js");
      if (existsSync(beside)) return beside;
    }
  } catch {
    // blocked by the bundler or the exports map ... fall through.
  }
  const fromCwd = join(process.cwd(), "node_modules", "pagedjs", "dist", "paged.polyfill.js");
  return existsSync(fromCwd) ? fromCwd : null;
}

/** the plex faces the page masters ask for: regular + italic prose, medium
 *  headings, bold strongs (a bold-italic synthesizes ... rare enough in print
 *  to not ship a fifth face). latin subset. */
const PLEX_FACES = [
  { file: "ibm-plex-serif-latin-400-normal.woff2", style: "normal", weight: 400 },
  { file: "ibm-plex-serif-latin-400-italic.woff2", style: "italic", weight: 400 },
  { file: "ibm-plex-serif-latin-500-normal.woff2", style: "normal", weight: 500 },
  { file: "ibm-plex-serif-latin-700-normal.woff2", style: "normal", weight: 700 },
] as const;

/** the ibm plex serif faces as data-uri @font-face css, so the book renders
 *  its REAL type on any chromium ... the serverless build ships no fonts at
 *  all, and a desktop machine may not have plex installed. never throws: a
 *  missing package or face just degrades to the css stack's georgia. */
async function plexFontFaceCss(): Promise<string> {
  // never imported as a module, so no bundler resolution to fight ... the
  // files sit in node_modules (dev, node servers) or beside the traced output.
  const dir = join(process.cwd(), "node_modules", "@fontsource", "ibm-plex-serif", "files");
  if (!existsSync(dir)) return "";
  const faces: string[] = [];
  for (const face of PLEX_FACES) {
    try {
      const data = await readFile(join(dir, face.file));
      faces.push(
        `@font-face{font-family:"IBM Plex Serif";font-style:${face.style};` +
          `font-weight:${face.weight};font-display:block;` +
          `src:url(data:font/woff2;base64,${data.toString("base64")}) format("woff2");}`,
      );
    } catch {
      // one face missing ... the others still land.
    }
  }
  return faces.join("\n");
}

/** the render budget, shared by every stage ... deliberately UNDER the route's
 *  maxDuration (120s) so the graceful in-process timeout fires before the
 *  platform's hard kill can sever the request mid-flight. */
const RENDER_BUDGET_MS = 90_000;

/** what's left on the shared clock ... throws when the budget is spent, so a
 *  stage never starts with a zero window. */
function remainingBudget(deadlineAt: number, label: string): number {
  const left = deadlineAt - Date.now();
  if (left <= 0) {
    throw new Error(`${label}: the render budget is spent`);
  }
  return left;
}

/** race a stage against the shared deadline (puppeteer's evaluate has no
 *  timeout of its own). */
function withDeadline<T>(work: Promise<T>, deadlineAt: number, label: string): Promise<T> {
  const ms = remainingBudget(deadlineAt, label);
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out ... the render budget is spent`)),
      ms,
    );
    work.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e instanceof Error ? e : new Error(String(e)));
      },
    );
  });
}

/**
 * set a complete book html document into a pdf. launches headless chromium,
 * loads the document (with the plex faces injected), injects pagedjs (auto
 * off), runs the previewer to break the book into pages, and prints with the
 * css page size.
 */
export async function renderBookPdf(html: string): Promise<Buffer> {
  const deadlineAt = Date.now() + RENDER_BUDGET_MS;

  const resolved = await resolveChromium();
  if (!resolved) {
    throw new TypesetUnavailableError("no chromium found on this host");
  }

  const polyfillPath = resolvePagedPolyfill();
  if (!polyfillPath) {
    throw new Error("pagedjs polyfill not found ... is pagedjs installed?");
  }
  const polyfill = await readFile(polyfillPath, "utf8");

  // our own bookDocument emits exactly one </head>, and every text run in the
  // body is escaped, so the first match is always ours to extend.
  const fontCss = await plexFontFaceCss();
  const doc = fontCss ? html.replace("</head>", `<style>${fontCss}</style></head>`) : html;

  const puppeteer = (await import("puppeteer-core")).default;
  let browser;
  try {
    browser = await withDeadline(
      puppeteer.launch({
        executablePath: resolved.executablePath,
        args: [...resolved.args, "--disable-dev-shm-usage"],
        headless: true,
      }),
      deadlineAt,
      "chromium launch",
    );
  } catch (err) {
    throw new TypesetUnavailableError(
      `chromium would not launch: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  try {
    const page = await browser.newPage();
    // puppeteer's own default would quietly cap any wait at 30s ... every wait
    // below carries the shared deadline explicitly, this is the backstop.
    page.setDefaultTimeout(RENDER_BUDGET_MS);

    await page.setContent(doc, {
      waitUntil: "load",
      timeout: remainingBudget(deadlineAt, "content load"),
    });

    // auto OFF must land before the polyfill script evaluates, or pagedjs
    // would start its own preview on inject and race the explicit one below.
    await page.evaluate(() => {
      (window as unknown as { PagedConfig: { auto: boolean } }).PagedConfig = { auto: false };
    });
    await page.addScriptTag({ content: polyfill });
    await withDeadline(
      page.evaluate(async () => {
        const w = window as unknown as {
          PagedPolyfill: { preview: () => Promise<unknown> };
        };
        await w.PagedPolyfill.preview();
      }),
      deadlineAt,
      "pagedjs preview",
    );

    const pdf = await withDeadline(
      page.pdf({
        preferCSSPageSize: true,
        printBackground: true,
        timeout: remainingBudget(deadlineAt, "pdf print"),
      }),
      deadlineAt,
      "pdf print",
    );
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
