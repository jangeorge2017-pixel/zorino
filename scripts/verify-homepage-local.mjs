/**
 * Verify homepage visual fixes on localhost (verification only).
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.HOMEPAGE_URL ?? "http://localhost:3000/";

async function main() {
  await mkdir(path.join(process.cwd(), "scripts", "output"), { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });

  const report = await page.evaluate(() => {
    const blog = [...document.querySelectorAll(".zh-nav__link")].find((el) =>
      el.textContent?.includes("Blog"),
    );
    const search = document.querySelector('.zh-nav__icon-btn[aria-label="Search"]');
    const profile = document.querySelector(".zh-nav__profile");
    const firstNavLink = document.querySelector(".zh-nav__link");
    const title = document.querySelector(".zh-featured-brands__title");
    const featuredWrap = document.querySelector(".zh-featured-brands-wrap");
    const categoriesWrap = document.querySelector(".zh-categories-wrap");
    const pageBg = document.querySelector(".zh-page__background");
    const cs = (el) => (el ? getComputedStyle(el) : null);

    const blogRect = blog?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();
    const featuredRect = featuredWrap?.getBoundingClientRect();
    const categoriesRect = categoriesWrap?.getBoundingClientRect();

    return {
      url: location.href,
      navInner: cs(document.querySelector(".zh-nav__inner"))
        ? {
            display: cs(document.querySelector(".zh-nav__inner")).display,
            gap: cs(document.querySelector(".zh-nav__inner")).gap,
          }
        : null,
      navLinkAfter: firstNavLink
        ? getComputedStyle(firstNavLink, "::after").boxShadow
        : null,
      blogToSearchGap:
        blogRect && searchRect
          ? Math.round(searchRect.left - blogRect.right)
          : null,
      profileVisible: profile
        ? {
            clipped: profile.getBoundingClientRect().right > window.innerWidth,
            right: Math.round(profile.getBoundingClientRect().right),
            viewport: window.innerWidth,
          }
        : null,
      featuredTitle: title
        ? {
            color: cs(title).color,
            fontWeight: cs(title).fontWeight,
            textShadow: cs(title).textShadow,
          }
        : null,
      featuredMarginTop: featuredWrap ? cs(featuredWrap).marginTop : null,
      categoriesMarginTop: categoriesWrap ? cs(categoriesWrap).marginTop : null,
      featuredToCategoriesGap:
        featuredRect && categoriesRect
          ? Math.round(categoriesRect.top - featuredRect.bottom)
          : null,
      pageBackground: pageBg ? cs(pageBg).backgroundColor : null,
    };
  });

  const screenshotPath = path.join(
    process.cwd(),
    "scripts",
    "output",
    "homepage-verification.png",
  );
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await browser.close();

  const checks = {
    backgroundNavy:
      report.pageBackground === "rgb(7, 11, 22)" ||
      report.pageBackground === "rgb(8, 16, 28)",
    hairlineNav:
      report.navLinkAfter?.includes("0.5px") &&
      !report.navLinkAfter?.includes("0px 0px 0px 1px"),
    blogSearchGap: (report.blogToSearchGap ?? 0) >= 12,
    profileVisible: report.profileVisible?.clipped === false,
    titleOrange: report.featuredTitle?.color === "rgb(255, 138, 0)",
    titleBold: report.featuredTitle?.fontWeight === "800",
    featuredSpacingMatches:
      report.featuredMarginTop === report.categoriesMarginTop,
  };

  console.log(JSON.stringify({ report, checks, screenshotPath }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
