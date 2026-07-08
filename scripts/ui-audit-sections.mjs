/**
 * Capture high-resolution per-section screenshots of the homepage.
 * Usage: node scripts/ui-audit-sections.mjs [baseUrl] [tag]
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const baseUrl = (process.argv[2] ?? "http://localhost:3000/en").replace(/\/$/, "");
const tag = process.argv[3] ?? "before";
const vw = Number(process.argv[4] ?? 1920);
const vh = Number(process.argv[5] ?? 1080);
const outDir = `scripts/output/ui-audit/sections-${tag}`;

const SELECTORS = [
  { name: "nav", sel: ".zh-nav" },
  { name: "hero-zone", sel: ".zh-hero-zone" },
  { name: "discovery-nav", sel: ".zh-home-discovery-nav" },
  { name: "featured-brands", sel: ".zh-featured-brands-wrap" },
  { name: "commerce", sel: ".hhb" },
  { name: "product-section-1", sel: ".zh-product-sections-wrap .zh-product-section:nth-of-type(1)" },
  { name: "cta", sel: ".zh-cta-band" },
  { name: "footer", sel: ".zh-footer" },
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
const context = await browser.newContext({
  viewport: { width: vw, height: vh },
  deviceScaleFactor: 2,
  locale: "en-US",
});
const page = await context.newPage();
await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90000 });
await page.waitForTimeout(2500);

for (const { name, sel } of SELECTORS) {
  const el = page.locator(sel).first();
  try {
    await el.scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(400);
    await el.screenshot({ path: `${outDir}/${name}.png` });
    console.log(`OK   ${name} (${sel})`);
  } catch (e) {
    console.log(`MISS ${name} (${sel}) -> ${e.message.split("\n")[0]}`);
  }
}

await browser.close();
console.log(`Done. Screenshots saved to ${outDir}/`);
