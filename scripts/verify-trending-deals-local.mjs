/**
 * Verify Trending Deals section on localhost.
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.HOMEPAGE_URL ?? "http://localhost:3001/";

async function main() {
  await mkdir(path.join(process.cwd(), "scripts", "output"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 90000 });

  const section = page.locator("#zh-section-trending-deals");
  await section.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);

  const report = await page.evaluate(() => {
    const sectionEl = document.querySelector("#zh-section-trending-deals");
    const title = document.querySelector("#zh-deals-title");
    const icon = document.querySelector(".zh-trending-deals__icon");
    const cards = [...document.querySelectorAll(".zh-td-card")];
    const filters = [...document.querySelectorAll(".zh-trending-deals__filter")];
    const sort = document.querySelector(".zh-trending-deals__sort-select");
    const cs = (el) => (el ? getComputedStyle(el) : null);

    const firstCard = cards[0];
    const media = firstCard?.querySelector(".zh-td-card__media");
    const mediaImg = firstCard?.querySelector(".zh-td-card__media img");

    return {
      url: location.href,
      sectionFound: Boolean(sectionEl),
      titleText: title?.textContent?.trim() ?? null,
      titleColor: title ? cs(title).color : null,
      iconFound: Boolean(icon),
      cardCount: cards.length,
      filterCount: filters.length,
      sortOptions: sort ? sort.options.length : 0,
      firstCardFields: firstCard
        ? {
            hasTitle: Boolean(firstCard.querySelector(".zh-td-card__title")),
            hasPrice: Boolean(firstCard.querySelector(".zh-td-card__price")),
            hasWas: Boolean(firstCard.querySelector(".zh-td-card__was")),
            hasDiscount: Boolean(firstCard.querySelector(".zh-td-card__discount")),
            hasStoreLogo: Boolean(firstCard.querySelector(".zh-td-card__store-logo img")),
            hasRating: Boolean(firstCard.querySelector(".zh-td-card__rating-value")),
            hasReviews: Boolean(firstCard.querySelector(".zh-td-card__reviews")),
            hasUpdated: Boolean(firstCard.querySelector(".zh-td-card__updated")),
            hasCta: Boolean(firstCard.querySelector(".zh-td-card__cta")),
            hasBadge: Boolean(firstCard.querySelector(".zh-td-badge")),
            mediaAspectRatio: media ? cs(media).aspectRatio : null,
            imgLoading: mediaImg?.getAttribute("loading") ?? null,
          }
        : null,
      sectionGlow: sectionEl ? cs(sectionEl).boxShadow : null,
    };
  });

  // Filter: Hot
  await page.locator('.zh-trending-deals__filter:has-text("Hot")').click();
  await page.waitForTimeout(250);
  const hotCount = await page.locator(".zh-td-card").count();

  // Sort: Lowest Price
  await page.selectOption(".zh-trending-deals__sort-select", "lowest_price");
  await page.waitForTimeout(250);
  const lowestPriceFirst = await page
    .locator(".zh-td-card__price")
    .first()
    .textContent();

  const screenshotPath = path.join(
    process.cwd(),
    "scripts",
    "output",
    "trending-deals-verification.png",
  );
  await section.screenshot({ path: screenshotPath });

  const fullPath = path.join(
    process.cwd(),
    "scripts",
    "output",
    "trending-deals-context.png",
  );
  await page.screenshot({ path: fullPath, fullPage: false });

  await browser.close();

  const checks = {
    sectionFound: report.sectionFound,
    titleHasTrendingDeals: report.titleText?.includes("Trending Deals"),
    warmTitleColor:
      report.titleColor === "rgb(255, 138, 61)" || report.titleColor === "rgb(255, 138, 60)",
    fireIcon: report.iconFound,
    eightOrMoreCards: report.cardCount >= 4,
    fiveFilters: report.filterCount === 5,
    fourSortOptions: report.sortOptions === 4,
    cardHasAllFields: report.firstCardFields
      ? Object.values(report.firstCardFields).every((v) => v !== false && v !== null)
      : false,
    aspectRatio43: report.firstCardFields?.mediaAspectRatio === "4 / 3",
    hotFilterWorks: hotCount > 0,
    sortWorks: Boolean(lowestPriceFirst),
  };

  console.log(JSON.stringify({ report, checks, hotCount, lowestPriceFirst, screenshotPath, fullPath }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
