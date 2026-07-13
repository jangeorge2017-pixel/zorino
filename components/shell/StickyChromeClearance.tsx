"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const STICKY_CHROME_SELECTORS = [
  ".zor-nav",
  ".zh-nav",
  ".zh-quick-nav.is-sticky",
] as const;

/** Bottom edge of the top sticky/fixed chrome stack, in CSS pixels. */
export function measureStickyChromeBottom(): number {
  let bottom = 0;
  for (const selector of STICKY_CHROME_SELECTORS) {
    for (const el of document.querySelectorAll(selector)) {
      const style = getComputedStyle(el);
      if (style.position !== "fixed" && style.position !== "sticky") continue;
      if (style.display === "none" || style.visibility === "hidden") continue;
      const rect = el.getBoundingClientRect();
      if (rect.height <= 0) continue;
      // Only count chrome stuck to the top of the viewport.
      if (rect.top > 1) continue;
      bottom = Math.max(bottom, rect.bottom);
    }
  }
  return Math.ceil(bottom);
}

function publishStickyClearance(px: number) {
  // Prefer the measured nav box when chrome is fixed (spacer uses this value).
  const nav =
    document.querySelector<HTMLElement>(".zor-nav") ||
    document.querySelector<HTMLElement>(".zh-nav");
  const navHeight = nav ? Math.ceil(nav.getBoundingClientRect().height) : 0;
  const stack = Math.max(px, navHeight);
  const value = `${Math.max(0, stack)}px`;
  const root = document.documentElement;
  root.style.setProperty("--zor-sticky-clearance", value);
  root.style.setProperty("--zh-sticky-clearance", value);
  if (navHeight > 0) {
    root.style.setProperty("--zor-nav-h", `${navHeight}px`);
    root.style.setProperty("--zh-nav-h", `${navHeight}px`);
  }

  /*
   * Page title anchors sit below eyebrows inside heroes. Offset each title by
   * measured sticky bottom + its offset within the first content block so the
   * first visible line clears the sticky chrome when scrolled into view.
   */
  document.querySelectorAll<HTMLElement>("[id$='-page-title']").forEach((title) => {
    const block =
      title.closest<HTMLElement>(
        "[class*='__hero'], .zor-page-header, section, article",
      ) ?? title;
    const blockTop = block.getBoundingClientRect().top;
    const titleTop = title.getBoundingClientRect().top;
    const withinBlock = Math.max(0, Math.round(titleTop - blockTop));
    title.style.scrollMarginTop = `${Math.max(0, stack) + withinBlock}px`;
  });

  document
    .querySelectorAll<HTMLElement>(
      ".zor-deals-page__hero, .zor-coupons-page__hero, .zor-compare-page__hero, .zor-categories-page__hero, .zor-stores-page__hero, .zor-blog-page__hero, .zor-page-header",
    )
    .forEach((hero) => {
      hero.style.scrollMarginTop = value;
    });
}

/**
 * Measures the rendered sticky header stack and publishes its height as
 * --zor-sticky-clearance / --zh-sticky-clearance for scroll-padding/margin.
 */
export default function StickyChromeClearance() {
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => {
      publishStickyClearance(measureStickyChromeBottom());
    };

    sync();
    // Titles/heroes mount after navigation — remeasure once layout settles.
    const raf = window.requestAnimationFrame(sync);
    const t = window.setTimeout(sync, 100);

    const observer = new ResizeObserver(sync);
    for (const selector of STICKY_CHROME_SELECTORS) {
      document.querySelectorAll(selector).forEach((el) => observer.observe(el));
    }

    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t);
      observer.disconnect();
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
    };
  }, [pathname]);

  return null;
}
