import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const url = process.argv[2] ?? "http://localhost:3000/en";
const out = process.argv[3] ?? "public/comparison/current-homepage-1920.png";

await mkdir("public/comparison", { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".homepage", { timeout: 15000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: out, fullPage: true });
console.log(`Saved ${out}`);

await browser.close();
