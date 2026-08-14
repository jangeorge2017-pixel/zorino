"use client";

import { useCallback, useEffect, useState } from "react";

/** Landscape / short-landscape — same slice as Mobile Normal CSS. */
export const MOBILE_NORMAL_MQ =
  "(max-width: 767px) and (orientation: landscape), (max-height: 500px) and (orientation: landscape) and (max-width: 1024px)";

type MobileNormalRowMoreProps = {
  /** Scrollport selector scoped under .zh-page */
  rowSelector: string;
  className: string;
  moreLabel: string;
  backLabel: string;
};

function isRtlEl(el: HTMLElement): boolean {
  return (
    document.documentElement.getAttribute("dir") === "rtl" ||
    getComputedStyle(el).direction === "rtl"
  );
}

/**
 * In-row polished chevron for Mobile Normal horizontal strips.
 * Hidden everywhere else via CSS (display:none default on the className).
 */
export default function MobileNormalRowMore({
  rowSelector,
  className,
  moreLabel,
  backLabel,
}: MobileNormalRowMoreProps) {
  const [isBack, setIsBack] = useState(false);

  const sync = useCallback(() => {
    if (!window.matchMedia(MOBILE_NORMAL_MQ).matches) {
      setIsBack(false);
      return;
    }
    const row = document.querySelector<HTMLElement>(`.zh-page ${rowSelector}`);
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    if (max <= 2) {
      setIsBack(false);
      return;
    }
    const rtl = isRtlEl(row);
    const mid = max * 0.45;
    const atEnd = rtl ? row.scrollLeft < -mid : row.scrollLeft > mid;
    setIsBack(atEnd);
  }, [rowSelector]);

  useEffect(() => {
    const row = document.querySelector<HTMLElement>(`.zh-page ${rowSelector}`);
    if (!row) return;
    sync();
    const onScroll = () => sync();
    row.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", sync);
    const mq = window.matchMedia(MOBILE_NORMAL_MQ);
    mq.addEventListener("change", sync);
    const ro = new ResizeObserver(sync);
    ro.observe(row);
    return () => {
      row.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sync);
      mq.removeEventListener("change", sync);
      ro.disconnect();
    };
  }, [rowSelector, sync]);

  const onClick = useCallback(() => {
    if (!window.matchMedia(MOBILE_NORMAL_MQ).matches) return;
    const row = document.querySelector<HTMLElement>(`.zh-page ${rowSelector}`);
    if (!row) return;
    const rtl = isRtlEl(row);
    const max = Math.max(0, row.scrollWidth - row.clientWidth);
    const left = isBack ? 0 : rtl ? -max : max;
    row.scrollTo({ left, behavior: "smooth" });
    setIsBack(!isBack);
  }, [isBack, rowSelector]);

  return (
    <button
      type="button"
      className={`${className}${isBack ? " is-back" : ""}`}
      aria-label={isBack ? backLabel : moreLabel}
      onClick={onClick}
    >
      <svg
        className={`${className}-icon`}
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M9 6l6 6-6 6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
