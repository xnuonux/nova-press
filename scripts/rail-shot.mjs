// partner-rail visual + behaviour verification. logs in, opens a throwaway
// piece, hands nova a line in the rail, and confirms the reply streams into a
// thread (writer turn + nova turn, live caret, settled text, zero em-dashes).
//
//   DEV_LOGIN_SECRET=... node scripts/rail-shot.mjs
//
// resilient by design: every step is guarded and we screenshot whatever
// renders, so a slow compile or model hiccup never blanks the run. a dev tool.
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

// SHOT_W under 1024 exercises the mobile drawer (the rail collapses to a
// tap-to-open sheet below lg); default is the desktop sidebar.
const VW = Number(process.env.SHOT_W ?? 1440);
const VH = Number(process.env.SHOT_H ?? 1000);
const MOBILE = VW < 1024;

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: 2,
});
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message}\n  STACK: ${(e.stack || "").split("\n").slice(0, 12).join(" | ")}`),
);
page.on("console", (m) => {
  if (m.type() === "error")
    errors.push(`console.error: ${m.text().split("\n").slice(0, 16).join(" | ")}`);
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

// the rail reads the latest nova turn (last <li>) ... text + whether the live
// caret is still blinking.
const readNova = () =>
  page.evaluate(() => {
    const items = [...document.querySelectorAll(".np-partner-rail ol li")];
    const last = items[items.length - 1];
    return {
      turns: items.length,
      novaText: (last?.querySelector("p")?.textContent || "").trim(),
      caret: !!document.querySelector(".np-partner-rail .np-caret"),
    };
  });

await step("login", async () => {
  const url = `${BASE}/api/dev/login?secret=${encodeURIComponent(SECRET)}&email=${encodeURIComponent(EMAIL)}`;
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(800);
});

await step("new-piece", async () => {
  await page.click('button:has-text("new piece")', { timeout: 30000 });
  await page.waitForSelector('[data-slate-editor="true"]', { timeout: 120000 });
  await page.waitForSelector(".np-partner-rail", { timeout: 30000 });
  await page.waitForTimeout(700);
});
// mobile: the rail is a drawer ... tap the floating nova button to open it
// before we can hand it a line. on desktop the FAB is hidden, so skip.
let drawerOpened = null;
if (MOBILE) {
  await step("open-drawer", async () => {
    await page.screenshot({ path: `${OUT}/rail-mobile-closed.png` });
    done.push("rail-mobile-closed");
    await page.click('[aria-label="open nova"]', { timeout: 8000 });
    await page.waitForTimeout(450);
    // the textarea should now be reachable (drawer slid in).
    drawerOpened = await page
      .locator('[aria-label="ask nova"]')
      .isVisible()
      .catch(() => false);
    console.log("drawer opened, input visible:", drawerOpened);
  });
}
await step("shot-rail-idle", () => shot(MOBILE ? "rail-mobile-open" : "rail-idle"));

let asked = null;
let streaming = null;
let settled = null;

await step("ask-nova", async () => {
  const box = page.locator('[aria-label="ask nova"]');
  await box.click();
  await box.fill("what do i do when the page is blank");
  await page.keyboard.press("Enter");
  // writer turn + nova placeholder should both appear.
  await page.waitForFunction(
    () => document.querySelectorAll(".np-partner-rail ol li").length >= 2,
    { timeout: 8000 },
  );
  asked = await readNova();
  console.log("asked:", JSON.stringify(asked));
  await page.screenshot({ path: `${OUT}/rail-asked.png` });
  done.push("rail-asked");
});

await step("stream", async () => {
  // catch it mid-stream: a caret blinking, or some text already landed.
  await page
    .waitForFunction(
      () => {
        const items = [...document.querySelectorAll(".np-partner-rail ol li")];
        const last = items[items.length - 1];
        const txt = (last?.querySelector("p")?.textContent || "").trim();
        return !!document.querySelector(".np-partner-rail .np-caret") || txt.length > 0;
      },
      { timeout: 30000 },
    )
    .catch(() => {});
  streaming = await readNova();
  console.log("streaming:", JSON.stringify(streaming));
  await page.screenshot({ path: `${OUT}/rail-streaming.png` });
  done.push("rail-streaming");
});

await step("settle", async () => {
  // wait for the caret to clear (the turn settled) with real text present.
  await page
    .waitForFunction(
      () => {
        const items = [...document.querySelectorAll(".np-partner-rail ol li")];
        const last = items[items.length - 1];
        const txt = (last?.querySelector("p")?.textContent || "").trim();
        return !document.querySelector(".np-partner-rail .np-caret") && txt.length > 0;
      },
      { timeout: 30000 },
    )
    .catch(() => {});
  await page.waitForTimeout(300);
  settled = await readNova();
  console.log("settled:", JSON.stringify(settled));
  await page.screenshot({ path: `${OUT}/rail-settled.png` });
  done.push("rail-settled");
});

await browser.close();

const emdashes = settled ? (settled.novaText.match(/[—–]/g) || []).length : -1;
const pass =
  settled &&
  settled.turns >= 2 &&
  settled.novaText.length > 0 &&
  !settled.caret &&
  emdashes === 0 &&
  (!MOBILE || drawerOpened === true);

console.log("\n=== report ===");
console.log("shots:", done.join(", ") || "(none)");
console.log("runtime errors:", errors.length);
for (const e of errors.slice(0, 12)) console.log("  -", e);
console.log("asked:", JSON.stringify(asked));
console.log("streaming:", JSON.stringify(streaming));
console.log("settled:", JSON.stringify(settled));
console.log("nova reply:", JSON.stringify(settled?.novaText?.slice(0, 160) || ""));
console.log(
  "RAIL VERDICT:",
  pass ? "PASS (thread + streamed reply + no em-dashes)" : "CHECK",
);
console.log("done", OUT);
