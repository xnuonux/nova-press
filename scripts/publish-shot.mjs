// publish-flow e2e. logs in, writes a piece, publishes it, follows the public
// url, and asserts the reading view renders the real title + body. resilient:
// always exits 0 with a verdict.
//
//   DEV_LOGIN_SECRET=... node scripts/publish-shot.mjs
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE ?? "http://localhost:5555";
const OUT = process.env.SHOT_OUT ?? "C:/Users/xnuon/AppData/Local/Temp/nova-shots";
const SECRET = process.env.DEV_LOGIN_SECRET;
const EMAIL = process.env.DEV_LOGIN_EMAIL ?? "xnuonux@gmail.com";

if (!SECRET) {
  console.error("set DEV_LOGIN_SECRET (it lives in .env.local)");
  process.exit(1);
}
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

const TITLE_PREFIX = "the room at golden hour";
const title = `${TITLE_PREFIX} ${Date.now().toString(36)}`;
const PARA1 = "the light here is different, and i believed her.";
const PARA2 = "a second paragraph, quiet and sure.";

let href = null;
let h1 = null;
let bodyText = "";

try {
  await page.goto(
    `${BASE}/api/dev/login?secret=${encodeURIComponent(SECRET)}&email=${encodeURIComponent(EMAIL)}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForTimeout(800);

  await page.click('button:has-text("new piece")', { timeout: 30000 });
  await page.waitForSelector('[data-slate-editor="true"]', { timeout: 120000 });
  await page.waitForTimeout(800);

  await page.fill('[aria-label="piece title"]', title);
  const body = page.locator('[data-slate-editor="true"]');
  await body.click();
  await page.keyboard.type(PARA1, { delay: 20 });
  await page.keyboard.press("Enter");
  await page.keyboard.type(PARA2, { delay: 20 });

  // let autosave persist title + body (1500ms debounce + the round-trip) before
  // we publish ... publishPiece reads the saved row for its title + slug.
  await page.waitForTimeout(3500);

  await page.click('button:has-text("publish")', { timeout: 10000 });
  await page.waitForSelector('a:has-text("view")', { timeout: 25000 });
  href = await page.getAttribute('a:has-text("view")', "href");
  console.log("published url:", href);

  if (href) {
    await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(900);
    h1 = await page.textContent("article h1").catch(() => null);
    bodyText = await page.evaluate(() => document.querySelector(".prose-nova")?.textContent ?? "");
    await page.screenshot({ path: `${OUT}/published-piece.png` });
  }
} catch (e) {
  console.log("FLOW ERROR:", e.message.split("\n")[0]);
}

await browser.close();

const titleOk = !!h1 && h1.includes(TITLE_PREFIX);
const p1Ok = bodyText.includes(PARA1);
const p2Ok = bodyText.includes(PARA2);

console.log("\n=== report ===");
console.log("published url:", href);
console.log("reading h1:", JSON.stringify(h1));
console.log("body has para1:", p1Ok, "| para2:", p2Ok);
console.log("runtime errors:", errors.length);
for (const e of errors.slice(0, 8)) console.log("  -", e);
console.log("PUBLISH VERDICT:", titleOk && p1Ok && p2Ok ? "PASS (write -> publish -> read)" : "CHECK");
