import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = "public/comparison";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

await page.goto(`${base}/en`, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForSelector(".homepage-bg-image", { timeout: 20000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${outDir}/homepage-background-final-1920.png`, fullPage: true });

await browser.close();
console.log("Saved homepage-background-final-1920.png");
