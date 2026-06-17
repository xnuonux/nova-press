// light visual capture: the routes that compile without the heavy editor
// bundle (landing + library). used by the perfection loop's grader for static
// visual evidence (motion is judged off the css; this catches layout + depth).
//   SHOT_BASE=http://localhost:5555 DEV_LOGIN_SECRET=... node scripts/light-shots.mjs
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE ?? "http://localhost:5555";
const OUT = process.env.SHOT_OUT ?? "C:/Users/xnuon/AppData/Local/Temp/nova-shots";
const SECRET = process.env.DEV_LOGIN_SECRET;
mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 2,
});
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

async function shot(name, url, wait = 1600) {
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(wait);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log("shot", name, "->", page.url());
  } catch (e) {
    console.log("FAIL", name, "::", e.message.split("\n")[0]);
  }
}

await shot("iter-landing", `${BASE}/`);
await shot("iter-reading", `${BASE}/p/example`, 1800);
if (SECRET) {
  await shot(
    "iter-library",
    `${BASE}/api/dev/login?secret=${encodeURIComponent(SECRET)}&email=xnuonux@gmail.com`,
    2000,
  );
}

await browser.close();
console.log("runtime errors:", errors.length);
for (const e of errors.slice(0, 8)) console.log("  -", e);
console.log("done", OUT);
