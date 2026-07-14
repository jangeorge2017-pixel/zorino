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
