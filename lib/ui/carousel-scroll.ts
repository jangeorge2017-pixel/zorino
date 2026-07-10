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
