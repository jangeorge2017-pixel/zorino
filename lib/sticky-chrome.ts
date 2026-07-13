/**
 * Global sticky chrome stack — single source of truth for scroll offsets.
 *
 * Any top navigation that can stick/fix must opt in with data-sticky-chrome.
 * Clearance is always the measured bottom edge of the active stack (no hardcoded px).
 */

export const STICKY_CHROME_EVENT = "zorino:sticky-chrome";

export type StickyChromeMeasurement = {
  /** Max bottom edge of all top-stuck chrome layers (scroll offset). */
  clearance: number;
  /** Primary main-nav height (spacers / secondary top). */
  navHeight: number;
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

  return {
    clearance: Math.ceil(clearance),
    navHeight: Math.ceil(navHeight),
  };
}

/** Read published clearance, or measure if the CSS var is not set yet. */
export function getStickyClearance(): number {
  if (typeof document === "undefined") return 0;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue("--zor-sticky-clearance")
    .trim();
  const parsed = Number.parseFloat(raw);
  if (Number.isFinite(parsed) && parsed > 0) return Math.ceil(parsed);
  return measureStickyChromeStack().clearance;
}

/**
 * Publish measured stack to CSS. All scroll-padding / scroll-margin / sticky
 * section tops must consume --zor-sticky-clearance (and --zor-sticky-stack).
 */
export function publishStickyChromeStack(
  measurement: StickyChromeMeasurement = measureStickyChromeStack(),
): StickyChromeMeasurement {
  const { clearance, navHeight } = measurement;
  const clearanceValue = `${Math.max(0, clearance)}px`;
  const navValue = `${Math.max(0, navHeight || clearance)}px`;
  const root = document.documentElement;

  root.style.setProperty("--zor-sticky-clearance", clearanceValue);
  root.style.setProperty("--zor-sticky-stack", clearanceValue);
  // Aliases for existing homepage CSS until fully migrated.
  root.style.setProperty("--zh-sticky-clearance", clearanceValue);
  root.style.setProperty("--zh-sticky-stack", clearanceValue);

  if (navHeight > 0) {
    root.style.setProperty("--zor-nav-h", navValue);
    root.style.setProperty("--zh-nav-h", navValue);
  }

  applyAnchorScrollMargins(clearance);

  return measurement;
}

/** Notify listeners (e.g. after quick-nav pins/unpins). */
export function notifyStickyChromeChanged(): void {
  if (typeof document === "undefined") return;
  document.dispatchEvent(new Event(STICKY_CHROME_EVENT));
}

/**
 * Anchors nested under heroes need scroll-margin = stack + offset within block
 * so the first visible line clears the chrome when scrolled into view.
 */
function applyAnchorScrollMargins(clearance: number): void {
  const value = `${Math.max(0, clearance)}px`;

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
    title.style.scrollMarginTop = `${Math.max(0, clearance) + withinBlock}px`;
  });

  // Homepage section roots used by quick-nav.
  document.querySelectorAll<HTMLElement>("[id^='zh-section-']").forEach((section) => {
    section.style.scrollMarginTop = value;
  });
}
