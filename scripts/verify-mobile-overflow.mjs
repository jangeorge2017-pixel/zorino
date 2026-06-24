/**
 * Detect horizontal overflow on the homepage at a mobile viewport.
 * Usage: node scripts/verify-mobile-overflow.mjs [url] [width]
 */
import puppeteer from "puppeteer";
import { existsSync } from "node:fs";

const url = process.argv[2] ?? "http://localhost:3000/en";
const width = Number(process.argv[3] ?? 390);
const height = 844;

const browserCandidates = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
].filter(Boolean);

const executablePath = browserCandidates.find((candidate) =>
  existsSync(candidate),
);

const browser = await puppeteer.launch({
  headless: true,
  executablePath,
});
const page = await browser.newPage();
await page.setViewport({ width, height, deviceScaleFactor: 1 });

try {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
} catch (error) {
  console.error(`Failed to load ${url}:`, error.message);
  await browser.close();
  process.exit(1);
}

const result = await page.evaluate(() => {
  const viewportWidth = document.documentElement.clientWidth;
  const scrollWidth = Math.max(
    document.documentElement.scrollWidth,
    document.body.scrollWidth,
  );
  const offenders = [];

  for (const el of document.querySelectorAll("*")) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;

    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    const overflowRight = rect.right - viewportWidth;
    const overflowLeft = -rect.left;

    if (overflowRight > 1 || overflowLeft > 1) {
      const selector =
        el.id ||
        (typeof el.className === "string" && el.className.trim()
          ? `.${el.className.trim().split(/\s+/).slice(0, 3).join(".")}`
          : el.tagName.toLowerCase());

      offenders.push({
        selector,
        tag: el.tagName.toLowerCase(),
        className: typeof el.className === "string" ? el.className : "",
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        overflowRight: Math.round(overflowRight),
        overflowLeft: Math.round(overflowLeft),
      });
    }
  }

  offenders.sort(
    (a, b) =>
      Math.max(b.overflowRight, b.overflowLeft) -
      Math.max(a.overflowRight, a.overflowLeft),
  );

  return {
    viewportWidth,
    scrollWidth,
    hasHorizontalScroll: scrollWidth > viewportWidth + 1,
    offenderCount: offenders.length,
    topOffenders: offenders.slice(0, 15),
  };
});

console.log(JSON.stringify(result, null, 2));

await browser.close();
process.exit(result.hasHorizontalScroll ? 1 : 0);
