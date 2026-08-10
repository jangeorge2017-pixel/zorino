/** Direction-aware carousel button enablement (handles negative scrollLeft in RTL). */
export function getCarouselScrollState(node: HTMLElement) {
  const max = Math.max(0, node.scrollWidth - node.clientWidth);
  if (max <= 4) {
    return { canScrollPrev: false, canScrollNext: false };
  }

  const left = node.scrollLeft;
  // Chromium RTL often uses negative scrollLeft; Firefox may use 0→max.
  if (left < 0) {
    return {
      canScrollPrev: left < -4,
      canScrollNext: left > -(max - 4),
    };
  }

  return {
    canScrollPrev: left > 4,
    canScrollNext: left < max - 4,
  };
}

/** Pixel step for exactly one slide (item width + track gap). */
export function getCarouselItemStep(node: HTMLElement, itemSelector: string): number {
  const item = node.querySelector(itemSelector);
  const styles = getComputedStyle(node);
  const gapRaw =
    styles.columnGap && styles.columnGap !== "normal" ? styles.columnGap : styles.gap;
  const gap = Number.parseFloat(gapRaw || "0") || 0;
  if (item instanceof HTMLElement) {
    return item.getBoundingClientRect().width + gap;
  }
  return Math.max(1, node.clientWidth + gap);
}

function getMostVisibleItemIndex(
  node: HTMLElement,
  items: HTMLElement[],
): number {
  const trackRect = node.getBoundingClientRect();
  let currentIndex = 0;
  let best = -1;
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    const overlap =
      Math.max(0, Math.min(r.right, trackRect.right) - Math.max(r.left, trackRect.left));
    if (overlap > best) {
      best = overlap;
      currentIndex = i;
    }
  }
  return currentIndex;
}

/**
 * Scroll a horizontal carousel by exactly one item.
 * Uses on-screen positions so LTR/RTL and negative scrollLeft both work.
 */
export function scrollCarouselByOneItem(
  node: HTMLElement,
  direction: -1 | 1,
  itemSelector: string,
): void {
  const items = Array.from(node.querySelectorAll<HTMLElement>(itemSelector));
  if (items.length < 2) return;

  const currentIndex = getMostVisibleItemIndex(node, items);
  const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
  if (nextIndex === currentIndex) return;

  const deltaX =
    items[nextIndex].getBoundingClientRect().left -
    items[currentIndex].getBoundingClientRect().left;
  if (Math.abs(deltaX) < 1) return;

  node.scrollBy({ left: deltaX, behavior: "smooth" });
}

/**
 * Horizontal overflow scrollers (`overflow-x: auto`) capture vertical wheel
 * even when they cannot scroll vertically — page scroll stalls under the
 * cursor. Forward dominant-vertical wheel to the document instead.
 */
export function attachVerticalWheelPassthrough(node: HTMLElement): () => void {
  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey) return;

    const absX = Math.abs(event.deltaX);
    const absY = Math.abs(event.deltaY);

    // Keep native horizontal swipe / shift+wheel on the track.
    if (event.shiftKey || absX > absY) return;
    if (absY < 0.5) return;

    event.preventDefault();
    window.scrollBy({ top: event.deltaY, left: 0, behavior: "auto" });
  };

  node.addEventListener("wheel", onWheel, { passive: false });
  return () => node.removeEventListener("wheel", onWheel);
}
