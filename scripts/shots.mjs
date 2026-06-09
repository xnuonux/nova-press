// visual-verification screenshots. boots against a running dev server on
// :3000, captures the public surfaces at desktop + mobile widths into a
// temp dir. not part of the build ... a dev/design tool.
import { mkdirSync } from "node:fs";

import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE ?? "http://localhost:3000";
const OUT = process.env.SHOT_OUT ?? "C:/Users/xnuon/AppData/Local/Temp/nova-shots";
mkdirSync(OUT, { recursive: true });

const shots = [
  { name: "landing-desktop", path: "/", w: 1440, h: 900 },
  { name: "landing-mobile", path: "/", w: 390, h: 844 },
  { name: "login-desktop", path: "/login", w: 1440, h: 900 },
  { name: "login-mobile", path: "/login", w: 390, h: 844 },
  { name: "reading-desktop", path: "/p/example", w: 1440, h: 1400, full: true },
  { name: "reading-mobile", path: "/p/example", w: 390, h: 844, full: true },
];

const browser = await chromium.launch();
for (const s of shots) {
  const page = await browser.newPage({
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 2,
  });
  await page.goto(`${BASE}${s.path}`, { waitUntil: "networkidle" });
  // let the staggered np-rise reveal finish (longest delay ~0.62s + 0.62s).
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/${s.name}.png`, fullPage: !!s.full });
  await page.close();
  console.log("shot", s.name);
}
await browser.close();
console.log("done", OUT);
