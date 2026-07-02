/**
 * Verify homepage header on localhost (header only).
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.HOMEPAGE_URL ?? "http://localhost:3000/";

async function inspect(page) {
  return page.evaluate(() => {
    const inner = document.querySelector(".zh-nav__inner");
    const blog = [...document.querySelectorAll(".zh-nav__link")].find((el) =>
      el.textContent?.includes("Blog"),
    );
    const search = document.querySelector('.zh-nav__icon-btn[aria-label="Search"]');
    const profile = document.querySelector(".zh-nav__profile");
    const navLink = document.querySelector(".zh-nav__link");
    const cs = (el) => (el ? getComputedStyle(el) : null);

    const gaps = [];
    const items = [
      ...document.querySelectorAll(
        ".zh-nav__logo, .zh-nav__link, .zh-nav__icon-btn, .zh-nav .theme-toggle, .zh-nav .zor-intl__trigger, .zh-nav__profile",
      ),
    ];
    for (let i = 0; i < items.length - 1; i += 1) {
      const a = items[i].getBoundingClientRect();
      const b = items[i + 1].getBoundingClientRect();
      gaps.push(Math.round(b.left - a.right));
    }

    const heights = items.map((el) => Math.round(el.getBoundingClientRect().height));

    const blogRect = blog?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();

    return {
      viewport: window.innerWidth,
      innerDisplay: cs(inner)?.display,
      innerGap: cs(inner)?.gap,
      innerAlign: cs(inner)?.alignItems,
      navLinkAfter: navLink ? getComputedStyle(navLink, "::after").boxShadow : null,
      blogToSearchGap:
        blogRect && searchRect
          ? Math.round(searchRect.left - blogRect.right)
          : null,
      profile: profile
        ? {
            right: Math.round(profile.getBoundingClientRect().right),
            viewport: window.innerWidth,
            clipped: profile.getBoundingClientRect().right > window.innerWidth,
          }
        : null,
      controlHeights: [...new Set(heights)].sort((a, b) => a - b),
      adjacentGaps: gaps,
    };
  });
}

async function main() {
  await mkdir(path.join(process.cwd(), "scripts", "output"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });

  const report1440 = await inspect(page);

  const headerPath = path.join(
    process.cwd(),
    "scripts",
    "output",
    "header-verification.png",
  );
  const homepagePath = path.join(
    process.cwd(),
    "scripts",
    "output",
    "homepage-header-context.png",
  );

  await page.screenshot({
    path: homepagePath,
    clip: { x: 0, y: 0, width: 1440, height: 520 },
  });

  const header = page.locator(".zh-nav");
  const box = await header.boundingBox();
  if (box) {
    await page.screenshot({
      path: headerPath,
      clip: { x: box.x, y: box.y, width: box.width, height: box.height },
    });
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 120000 });
  const report1280 = await inspect(page);

  await browser.close();

  const checks = (report) => ({
    flexLayout: report.innerDisplay === "flex",
    equalGap: report.innerGap === "10px" || report.innerGap === "8px",
    hairlineNav:
      report.navLinkAfter?.includes("0.5px") &&
      !report.navLinkAfter?.includes("0px 0px 0px 1px"),
    profileVisible: report.profile?.clipped === false,
    uniformHeights: report.controlHeights.length <= 2,
    blogSearchSeparated: (report.blogToSearchGap ?? 0) >= 8,
    equalAdjacentGaps:
      report.adjacentGaps.length > 0 &&
      report.adjacentGaps.every((g) => g === report.adjacentGaps[0]),
  });

  console.log(
    JSON.stringify(
      {
        report1440,
        checks1440: checks(report1440),
        report1280,
        checks1280: checks(report1280),
        headerPath,
        homepagePath,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
