import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = "public/comparison";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });

await page.goto(`${base}/comparison/logo-comparison.html`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(500);
await page.screenshot({ path: `${outDir}/logo-before-after-comparison.png`, fullPage: true });
console.log("Saved logo-before-after-comparison.png");

await page.goto(`${base}/en`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".logo-z-mark", { timeout: 15000 });
await page.locator(".logo").screenshot({ path: `${outDir}/logo-after-navbar-live.png` });
await page.locator(".hero-scene-image").screenshot({ path: `${outDir}/logo-after-hero-live.png` });
console.log("Saved live navbar and hero logo screenshots");

await browser.close();
