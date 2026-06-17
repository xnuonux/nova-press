// flow-detector e2e. confirms the partner rail ducks away while typing and
// returns on a pause. fast + resilient; always exits with a verdict.
import { chromium } from "playwright";

const BASE = process.env.SHOT_BASE ?? "http://localhost:5555";
const SECRET = process.env.DEV_LOGIN_SECRET;
const EMAIL = process.env.DEV_LOGIN_EMAIL ?? "xnuonux@gmail.com";

if (!SECRET) {
  console.error("set DEV_LOGIN_SECRET (it lives in .env.local)");
  process.exit(1);
}

const browser = await chromium.launch();
// >= lg so the partner rail (hidden lg:flex) actually renders.
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));

let railPresent = false;
let typing = null;
let paused = null;

function railState() {
  const el = document.querySelector(".np-partner-rail");
  return {
    flow: document.body.classList.contains("np-flow"),
    opacity: el ? parseFloat(getComputedStyle(el).opacity) : -1,
  };
}

try {
  await page.goto(
    `${BASE}/api/dev/login?secret=${encodeURIComponent(SECRET)}&email=${encodeURIComponent(EMAIL)}`,
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForTimeout(700);
  await page.click('button:has-text("new piece")', { timeout: 30000 });
  await page.waitForSelector('[data-slate-editor="true"]', { timeout: 120000 });
  await page.waitForTimeout(700);

  railPresent = await page.evaluate(() => !!document.querySelector(".np-partner-rail"));

  await page.locator('[data-slate-editor="true"]').click();
  await page.keyboard.type("nova should go quiet while i write this line.", { delay: 25 });
  await page.waitForTimeout(150);
  typing = await page.evaluate(railState);

  await page.waitForTimeout(3200); // past the 2.5s pause + the ease-back
  paused = await page.evaluate(railState);
} catch (e) {
  console.log("FLOW ERROR:", e.message.split("\n")[0]);
}

await browser.close();

console.log("rail present:", railPresent);
console.log("typing:", JSON.stringify(typing));
console.log("paused:", JSON.stringify(paused));
console.log("errors:", errors.length);
const ok =
  railPresent &&
  typing &&
  paused &&
  typing.flow === true &&
  paused.flow === false &&
  typing.opacity < paused.opacity;
console.log("FLOW VERDICT:", ok ? "PASS (rail ducks on type, returns on pause)" : "CHECK");
