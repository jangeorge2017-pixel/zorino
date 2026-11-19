/**
 * Capture production search result screenshots for Phase 3 verification.
 * Usage: node scripts/phase3-search-screenshots.mjs [baseUrl]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = (process.argv[2] ?? "https://www.zorino.org/en").replace(/\/$/, "");
const outDir = "scripts/output/phase3-search";

const QUERIES = [
  { q: "iPhone 15", file: "iphone-15.png" },
  { q: "Samsung S24", file: "samsung-s24.png" },
  { q: "Galaxy Fold", file: "galaxy-fold.png" },
  { q: "MacBook Air", file: "macbook-air.png" },
  { q: "PS5", file: "ps5.png" },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
  locale: "en-US",
});
const page = await context.newPage();

for (const { q, file } of QUERIES) {
  const url = `${baseUrl}/search?q=${encodeURIComponent(q)}`;
  console.log(`Capturing: ${q} → ${outDir}/${file}`);
  await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector(".zor-page, .listing-products-grid, .zor-page-state", {
    timeout: 30000,
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/${file}`, fullPage: true });
}

await browser.close();
console.log(`Done. Screenshots saved to ${outDir}/`);
