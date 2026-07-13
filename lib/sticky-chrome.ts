/**
 * Global sticky chrome stack — single source of truth for scroll offsets.
 *
 * Any top navigation that can stick/fix must opt in with data-sticky-chrome.
 *
 * --zor-sticky-clearance     = live measured stack (sticky `top`, spacers)
 * --zor-sticky-scroll-clearance = predicted stack for scroll-padding / scroll-margin
 *   / programmatic scroll. Includes secondary chrome that will pin by the time
 *   the target arrives (fixes from-top clicks that used to land under quick-nav).
 */

export const STICKY_CHROME_EVENT = "zorino:sticky-chrome";

export type StickyChromeMeasurement = {
  /** Max bottom edge of all currently stuck chrome layers. */
  clearance: number;
  /** Primary main-nav height (spacers / secondary top). */
  navHeight: number;
  /**
   * Clearance to use when scrolling a target into view.
   * Max of live clearance and primary + secondary when secondary exists.
   */
  scrollClearance: number;
};

/** Live measure of every opted-in sticky/fixed chrome layer at the top. */
export function measureStickyChromeStack(): StickyChromeMeasurement {
  type Layer = { top: number; bottom: number; height: number; role: string };
  const layers: Layer[] = [];

  document.querySelectorAll<HTMLElement>("[data-sticky-chrome]").forEach((el) => {
    const style = getComputedStyle(el);
    if (style.position !== "fixed" && style.position !== "sticky") return;
    if (style.display === "none" || style.visibility === "hidden") return;
    const rect = el.getBoundingClientRect();
    if (rect.height <= 0) return;
    // Ignore layers that are fully off-screen or deep in the page.
    if (rect.bottom <= 0 || rect.top > window.innerHeight * 0.5) return;
    layers.push({
      top: rect.top,
      bottom: rect.bottom,
      height: rect.height,
      role: el.getAttribute("data-sticky-chrome") || "",
    });
  });

  layers.sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  let clearance = 0;
  let navHeight = 0;

  for (const layer of layers) {
    // Build a contiguous stack from the top of the viewport.
    if (clearance === 0) {
      if (layer.top > 2) continue;
      clearance = layer.bottom;
    } else if (Math.abs(layer.top - clearance) <= 4) {
      clearance = Math.max(clearance, layer.bottom);
    } else {
      continue;
    }
    if (layer.role === "primary") {
      navHeight = Math.max(navHeight, Math.ceil(layer.height));
    }
  }

  const primary = document.querySelector<HTMLElement>(
    '[data-sticky-chrome="primary"]',
  );
  if (primary && navHeight === 0) {
    navHeight = Math.ceil(primary.getBoundingClientRect().height);
  }
  if (navHeight > 0) {
    clearance = Math.max(clearance, navHeight);
  }

  const scrollClearance = predictScrollClearance(Math.ceil(clearance), Math.ceil(navHeight));

  return {
    clearance: Math.ceil(clearance),
    navHeight: Math.ceil(navHeight),
    scrollClearance,
  };
}

/**
 * Predict the sticky stack that will be active once a below-the-fold
 * section is scrolled into view. Secondary chrome (quick-nav) often is not
 * pinned yet at click time, but pins during the scroll — using only the live
 * stack under-offsets and leaves titles under the secondary bar.
 */
function predictScrollClearance(liveClearance: number, navHeight: number): number {
  const secondary = document.querySelector<HTMLElement>(
    '[data-sticky-chrome="secondary"]',
  );
  if (!secondary) return liveClearance;

  const style = getComputedStyle(secondary);
  if (style.display === "none" || style.visibility === "hidden") {
    return liveClearance;
  }

  const secondaryHeight = Math.ceil(secondary.getBoundingClientRect().height);
  if (secondaryHeight <= 0) return liveClearance;

  const primaryHeight =
    navHeight ||
    Math.ceil(
      document
        .querySelector<HTMLElement>('[data-sticky-chrome="primary"]')
        ?.getBoundingClientRect().height || 0,
    );

  if (primaryHeight <= 0) return liveClearance;

  // +1px guards subpixel rounding so titles never sit under the stack edge.
  return Math.max(liveClearance, primaryHeight + secondaryHeight + 1);
}

/**
 * Clearance for scroll-padding, scroll-margin, and programmatic scrollTo.
 * Prefer published --zor-sticky-scroll-clearance; fall back to prediction.
 */
export function getStickyClearance(): number {
  if (typeof document === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--zor-sticky-scroll-clearance")
    .trim();
  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && parsed > 0) return Math.ceil(parsed);
  return measureStickyChromeStack().scrollClearance;
}

/**
 * Publish measured stack to CSS.
 * Live clearance → sticky tops / spacers.
 * Scroll clearance → scroll-padding / scroll-margin / JS scroll offset.
 */
export function publishStickyChromeStack(
  measurement: StickyChromeMeasurement = measureStickyChromeStack(),
): StickyChromeMeasurement {
  const { clearance, navHeight, scrollClearance } = measurement;
  const clearanceValue = `${Math.max(0, clearance)}px`;
  const scrollValue = `${Math.max(0, scrollClearance)}px`;
  const navValue = `${Math.max(0, navHeight || clearance)}px`;
  const root = document.documentElement;

  root.style.setProperty("--zor-sticky-clearance", clearanceValue);
  root.style.setProperty("--zor-sticky-stack", clearanceValue);
  root.style.setProperty("--zor-sticky-scroll-clearance", scrollValue);
  // Aliases for existing homepage CSS until fully migrated.
  root.style.setProperty("--zh-sticky-clearance", clearanceValue);
  root.style.setProperty("--zh-sticky-stack", clearanceValue);
  root.style.setProperty("--zh-sticky-scroll-clearance", scrollValue);

  if (navHeight > 0) {
    root.style.setProperty("--zor-nav-h", navValue);
    root.style.setProperty("--zh-nav-h", navValue);
  }

  applyAnchorScrollMargins(scrollClearance);

  return measurement;
}

/** Notify listeners (e.g. after quick-nav pins/unpins). */
export function notifyStickyChromeChanged(): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new Event(STICKY_CHROME_EVENT));
}

/**
 * Anchors nested under heroes need scroll-margin = scroll stack + offset within
 * block so the first visible line clears the chrome when scrolled into view.
 */
function applyAnchorScrollMargins(scrollClearance: number): void {
  const value = `${Math.max(0, scrollClearance)}px`;

  document
    .querySelectorAll<HTMLElement>(
      ".zor-deals-page__hero, .zor-coupons-page__hero, .zor-compare-page__hero, .zor-categories-page__hero, .zor-stores-page__hero, .zor-blog-page__hero, .zor-page-header, [data-scroll-anchor]",
    )
    .forEach((el) => {
      el.style.scrollMarginTop = value;
    });

  document.querySelectorAll<HTMLElement>("[id$='-page-title']").forEach((title) => {
    const block =
      title.closest<HTMLElement>(
        "[class*='__hero'], .zor-page-header, [data-scroll-anchor], section, article",
      ) ?? title;
    const withinBlock = Math.max(
      0,
      Math.round(title.getBoundingClientRect().top - block.getBoundingClientRect().top),
    );
    title.style.scrollMarginTop = `${Math.max(0, scrollClearance) + withinBlock}px`;
  });

  // Homepage section roots used by quick-nav.
  document.querySelectorAll<HTMLElement>("[id^='zh-section-']").forEach((section) => {
    section.style.scrollMarginTop = value;
  });
}
