/**
 * UI audit screenshots for the homepage at multiple viewports.
 * Usage: node scripts/ui-audit-shots.mjs [baseUrl] [tag]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = (process.argv[2] ?? "http://localhost:3000/en").replace(/\/$/, "");
const tag = process.argv[3] ?? "before";
const outDir = `scripts/output/ui-audit/${tag}`;

const VIEWPORTS = [
  { name: "desktop-1920", width: 1920, height: 1080 },
  { name: "laptop-1440", width: 1440, height: 900 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "mobile-390", width: 390, height: 844 },
];

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

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
    locale: "en-US",
  });
  const page = await context.newPage();
  console.log(`Capturing ${vp.name} → ${outDir}/${vp.name}.png`);
  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/${vp.name}.png`, fullPage: true });
  await context.close();
}

await browser.close();
console.log(`Done. Screenshots saved to ${outDir}/`);
