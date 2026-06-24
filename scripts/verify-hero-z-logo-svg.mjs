import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = "public/comparison";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ deviceScaleFactor: 2 });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

await page.goto(`${base}/comparison/hero-z-logo-svg-check.html`, {
  waitUntil: "networkidle",
  timeout: 30000,
});
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/hero-z-logo-png-vs-svg.png`, fullPage: true });

await page.goto(`${base}/en`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".logo-lockup", { timeout: 15000 });
await page.locator(".logo").screenshot({ path: `${outDir}/hero-z-logo-navbar-live.png` });

await browser.close();
console.log("Saved hero-z-logo-png-vs-svg.png and hero-z-logo-navbar-live.png");
