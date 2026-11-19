/**
 * Capture a single selector at a chosen viewport for close inspection.
 * Usage: node scripts/ui-audit-one.mjs <selector> <outName> [baseUrl] [vw] [vh]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const selector = process.argv[2];
const outName = process.argv[3] ?? "one";
const baseUrl = (process.argv[4] ?? "http://localhost:3000/en").replace(/\/$/, "");
const vw = Number(process.argv[5] ?? 1920);
const vh = Number(process.argv[6] ?? 1080);
const outDir = "scripts/output/ui-audit/one";

await mkdir(outDir, { recursive: true });

async function launchBrowser() {
  for (const channel of ["msedge", "chrome"]) {
    try {
      return await chromium.launch({ channel });
    } catch {
      // try next channel
    }
  }
  return chromium.launch();
}

const browser = await launchBrowser();
const context = await browser.newContext({
  viewport: { width: vw, height: vh },
  deviceScaleFactor: 2,
  locale: "en-US",
});
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2000);
const el = page.locator(selector).first();
await el.scrollIntoViewIfNeeded({ timeout: 5000 });
await page.waitForTimeout(400);
await el.screenshot({ path: `${outDir}/${outName}.png` });
console.log(`OK ${outName} (${selector}) -> ${outDir}/${outName}.png`);
await browser.close();
