/**
 * Global sticky chrome stack — single source of truth for scroll offsets.
 *
 * Any top navigation that can stick/fix must opt in with data-sticky-chrome.
 *
 * --zor-sticky-clearance     = primary nav only (stable; secondary pin never rewrites)
 * --zor-sticky-scroll-clearance = CSS-owned calc(nav + quick-nav) for
 *   scroll-padding / scroll-margin / programmatic scroll. JS updates
 *   --zh-quick-nav-h; it does not overwrite the scroll token.
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

/** Live measure of primary sticky/fixed chrome only (stable; pin does not rewrite). */
export function measureStickyChromeStack(): StickyChromeMeasurement {
  const primary = document.querySelector<HTMLElement>(
    '[data-sticky-chrome="primary"]',
  );

  let navHeight = 0;
  let clearance = 0;

  if (primary) {
    const style = getComputedStyle(primary);
    if (
      (style.position === "fixed" || style.position === "sticky") &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    ) {
      const rect = primary.getBoundingClientRect();
      if (rect.height > 0) {
        navHeight = Math.ceil(rect.height);
        // Primary-only live clearance — secondary pin must not change this token.
        clearance = navHeight;
      }
    }
  }

  const scrollClearance = predictScrollClearance(
    Math.ceil(clearance),
    Math.ceil(navHeight),
  );

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
  // Secondary (homepage quick-nav) must stay on the home shell only.
  if (!secondary || !secondary.closest(".zh-page")) return liveClearance;

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
 * Prefer resolved CSS scroll-padding-top (handles calc(...)); fall back to prediction.
 */
export function getStickyClearance(): number {
  if (typeof document === "undefined") return 0;
  const pad = Number.parseFloat(
    getComputedStyle(document.documentElement).scrollPaddingTop,
  );
  if (Number.isFinite(pad) && pad > 0) return Math.ceil(pad);

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
  const { clearance, scrollClearance } = measurement;
  const clearanceValue = `${Math.max(0, clearance)}px`;
  const root = document.documentElement;

  // Live stack for consumers that read pinned chrome height.
  // Never rewrite --zor-nav-h / --zh-nav-h — those stay CSS-locked so the
  // main navbar cannot resize/jump while scrolling.
  root.style.setProperty("--zor-sticky-clearance", clearanceValue);
  root.style.setProperty("--zor-sticky-stack", clearanceValue);
  root.style.setProperty("--zh-sticky-clearance", clearanceValue);
  root.style.setProperty("--zh-sticky-stack", clearanceValue);

  // --zor-sticky-scroll-clearance stays CSS-owned (calc of nav + quick-nav).
  void scrollClearance;
  return measurement;
}

/** Notify listeners (e.g. after quick-nav pins/unpins). */
export function notifyStickyChromeChanged(): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new Event(STICKY_CHROME_EVENT));
}
