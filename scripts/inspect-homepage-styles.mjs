/**
 * Inspect homepage computed CSS on localhost (verification only).
 */
import { chromium } from "playwright";

const BASE = process.env.HOMEPAGE_URL ?? "http://localhost:3000/";

function pick(styles, keys) {
  return Object.fromEntries(keys.map((k) => [k, styles[k]]));
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ];

  const page = await browser.newPage();

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });

    const report = await page.evaluate(() => {
    const navInner = document.querySelector(".zh-nav__inner");
    const navLinks = document.querySelector(".zh-nav__links");
    const blog = [...document.querySelectorAll(".zh-nav__link")].find((el) =>
      el.textContent?.includes("Blog"),
    );
    const search = document.querySelector('.zh-nav__icon-btn[aria-label="Search"]');
    const profile = document.querySelector(".zh-nav__profile");
    const firstNavLink = document.querySelector(".zh-nav__link");
    const title = document.querySelector(".zh-featured-brands__title");
    const featuredWrap = document.querySelector(".zh-featured-brands-wrap");
    const featuredPanel = document.querySelector(".zh-featured-brands.zh-panel");
    const heroSearch = document.querySelector(".zh-hero-search");
    const searchBar = document.querySelector(".zh-search");
    const pageBgBefore = document.querySelector(".zh-page__background");
    const stats = document.querySelector(".zh-hero__stats");
    const heroZone = document.querySelector(".zh-hero-zone");

    const cs = (el) => (el ? getComputedStyle(el) : null);
    const navLinkAfter = firstNavLink
      ? getComputedStyle(firstNavLink, "::after")
      : null;

    const blogRect = blog?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();

    const statsRect = stats?.getBoundingClientRect();
    const heroSearchRect = heroSearch?.getBoundingClientRect();
    const searchBarRect = searchBar?.getBoundingClientRect();
    const featuredRect = featuredWrap?.getBoundingClientRect();
    const heroZoneRect = heroZone?.getBoundingClientRect();
    const zhPage = document.querySelector(".zh-page");

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      hasZhPage: !!document.querySelector(".zh-page"),
      navInner: navInner
        ? {
            display: cs(navInner).display,
            gap: cs(navInner).gap,
            overflow: cs(navInner).overflow,
          }
        : null,
      navLinks: navLinks ? { display: cs(navLinks).display } : null,
      navActions: document.querySelector(".zh-nav__actions")
        ? { display: cs(document.querySelector(".zh-nav__actions")).display }
        : null,
      navLinkAfter: navLinkAfter
        ? {
            boxShadow: navLinkAfter.boxShadow,
            content: navLinkAfter.content,
          }
        : null,
      navLinkBefore: firstNavLink
        ? {
            content: getComputedStyle(firstNavLink, "::before").content,
            backgroundColor: getComputedStyle(firstNavLink, "::before")
              .backgroundColor,
          }
        : null,
      blogToSearchGap:
        blogRect && searchRect
          ? Math.round(searchRect.left - blogRect.right)
          : null,
      profileVisible: profile
        ? {
            marginLeft: cs(profile).marginLeft,
            flexShrink: cs(profile).flexShrink,
            right: Math.round(profile.getBoundingClientRect().right),
            viewport: window.innerWidth,
            clipped: profile.getBoundingClientRect().right > window.innerWidth,
          }
        : null,
      featuredTitle: title
        ? {
            color: cs(title).color,
            fontSize: cs(title).fontSize,
            fontWeight: cs(title).fontWeight,
            fontFamily: cs(title).fontFamily,
            letterSpacing: cs(title).letterSpacing,
            textShadow: cs(title).textShadow,
          }
        : null,
      spacing: {
        statsToSearch:
          statsRect && heroSearchRect
            ? Math.round(heroSearchRect.top - statsRect.bottom)
            : null,
        searchBarToFeatured:
          searchBarRect && featuredRect
            ? Math.round(featuredRect.top - searchBarRect.bottom)
            : null,
        searchWrapToFeatured:
          heroSearchRect && featuredRect
            ? Math.round(featuredRect.top - heroSearchRect.bottom)
            : null,
        heroZoneBottomToFeatured:
          heroZoneRect && featuredRect
            ? Math.round(featuredRect.top - heroZoneRect.bottom)
            : null,
        featuredWrapMarginTop: featuredWrap ? cs(featuredWrap).marginTop : null,
        featuredPanelPaddingTop: featuredPanel
          ? cs(featuredPanel).paddingTop
          : null,
        heroSearchMarginBottom: heroSearch ? cs(heroSearch).marginBottom : null,
        heroZonePaddingBottom: heroZone ? cs(heroZone).paddingBottom : null,
      },
      pageBackground: pageBgBefore
        ? {
            backgroundColor: cs(pageBgBefore).backgroundColor,
          }
        : null,
      cssVars: {
        spaceStatsSearch: zhPage
          ? getComputedStyle(zhPage).getPropertyValue("--zh-space-stats-search").trim()
          : "",
      },
    };
  });

  console.log(`\n=== viewport ${viewport.width}x${viewport.height} ===`);
  console.log(JSON.stringify(report, null, 2));
  }

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
