import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3000";
const outDir = "public/comparison";
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ deviceScaleFactor: 2 });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

await page.goto(`${base}/en`, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForSelector(".logo-z-mark", { timeout: 15000 });
await page.waitForTimeout(1000);

await page.locator(".logo-z-mark").screenshot({ path: `${outDir}/logo-production-navbar-2x.png` });
await page.locator(".hero-scene-image").screenshot({ path: `${outDir}/logo-production-hero-2x.png` });
await page.locator(".logo").screenshot({ path: `${outDir}/logo-production-navbar-block-2x.png` });

await page.setViewportSize({ width: 1920, height: 1080 });
await page.goto(`${base}/comparison/logo-quality-check.html`, { waitUntil: "networkidle" }).catch(() => null);

await browser.close();
console.log("Saved production logo verification screenshots");
