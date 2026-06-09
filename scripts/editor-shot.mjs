// editor visual-verification. logs in via the dev-login route (secret from
// env, never hardcoded), spins up a throwaway piece, exercises the classics
// (tab indent, smart quotes, emoji) + the bubble toolbar, and captures shots.
//
//   DEV_LOGIN_SECRET=... DEV_LOGIN_EMAIL=... node scripts/editor-shot.mjs
//
// resilient by design: each step is guarded, runtime/console errors are
// captured, and we screenshot whatever renders. always exits 0 with a report
// so a single slow compile never blanks the whole run. a dev/design tool.
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "C:/Users/xnuon/AppData/Local/Temp/nova-shots";
const SECRET = process.env.DEV_LOGIN_SECRET;
const EMAIL = process.env.DEV_LOGIN_EMAIL ?? "xnuonux@gmail.com";

if (!SECRET) {
  console.error("set DEV_LOGIN_SECRET (it lives in .env.local)");
  process.exit(1);
}

mkdirSync(OUT, { recursive: true });

const errors = [];
const done = [];

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
});

async function shot(name) {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  done.push(name);
  console.log("shot", name);
}

async function step(label, fn) {
  try {
    await fn();
    console.log("ok", label);
  } catch (e) {
    console.log("FAIL", label, "::", e.message.split("\n")[0]);
  }
}

// 1. session via the dev-login route -> lands on /library
await step("login", async () => {
  const loginUrl = `${BASE}/api/dev/login?secret=${encodeURIComponent(SECRET)}&email=${encodeURIComponent(EMAIL)}`;
  await page.goto(loginUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(800);
  console.log("url after login:", page.url());
});

// 2. fresh throwaway piece -> editor
await step("new-piece", async () => {
  await page.click('button:has-text("new piece")', { timeout: 30000 });
  await page.waitForSelector('[data-slate-editor="true"]', { timeout: 120000 });
  await page.waitForTimeout(900);
});
await step("shot-fresh", () => shot("editor-fresh"));

// 3. title + body, exercising tab-indent + smart quotes
await step("type-body", async () => {
  await page.fill('[aria-label="piece title"]', "the room at golden hour ... delete me");
  const body = page.locator('[data-slate-editor="true"]');
  await body.click();
  await page.keyboard.press("Tab");
  await page.keyboard.type(
    'she said "the light here is different" and i believed her. it doesn\'t lie.',
  );
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await page.keyboard.type("a second paragraph, indented like the good old days.");
  await page.waitForTimeout(600);
});
await step("shot-typed", () => shot("editor-typed"));

// 4. emoji picker
await step("emoji", async () => {
  await page.keyboard.press("Enter");
  await page.keyboard.type("the muse arrives at :golden");
  await page.waitForTimeout(500);
});
await step("shot-emoji", () => shot("editor-emoji"));
await step("emoji-accept", async () => {
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
});

// 5. bubble toolbar on selection
await step("select", async () => {
  await page.dblclick("text=different", { timeout: 10000 });
  await page.waitForTimeout(450);
});
await step("shot-toolbar", () => shot("editor-toolbar"));

// 6. focus mode ... ctrl+. drops the chrome and dims everything but the line
await step("focus-mode", async () => {
  await page.keyboard.press("Escape"); // clear the selection + toolbar
  await page.locator('[data-slate-editor="true"]').click();
  await page.keyboard.press("Control+.");
  await page.waitForTimeout(500);
});
await step("shot-focus", () => shot("editor-focus"));
await step("focus-exit", async () => {
  await page.keyboard.press("Escape"); // leave focus mode
  await page.waitForTimeout(300);
});

// 7. repurpose panel (just open it ... do not wait on the model)
await step("repurpose-open", async () => {
  await page.click('button:has-text("repurpose")', { timeout: 10000 });
  await page.waitForTimeout(700);
});
await step("shot-repurpose", () => shot("editor-repurpose"));

await browser.close();

console.log("\n=== report ===");
console.log("shots:", done.join(", ") || "(none)");
console.log("runtime errors:", errors.length);
for (const e of errors.slice(0, 12)) console.log("  -", e);
console.log("done", OUT);
