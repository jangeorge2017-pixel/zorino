"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  STICKY_CHROME_EVENT,
  measureStickyChromeStack,
  publishStickyChromeStack,
} from "@/lib/sticky-chrome";

const LOCALES = ["en", "ar"] as const;

function isHomepage(pathname: string): boolean {
  if (pathname === "/") return true;
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments.length === 1 &&
    LOCALES.includes(segments[0] as (typeof LOCALES)[number])
  );
}

/**
 * Publishes live --zor-sticky-clearance (pinned stack).
 * Scroll offset (--zor-sticky-scroll-clearance) stays CSS-owned.
 */
export default function StickyChromeClearance() {
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => {
      // Drop any legacy inline scroll-clearance writes so CSS calc owns the offset.
      document.documentElement.style.removeProperty("--zor-sticky-scroll-clearance");
      document.documentElement.style.removeProperty("--zh-sticky-scroll-clearance");

      // Off-home: drop homepage quick-nav tokens so scroll offset is primary-only.
      if (!isHomepage(pathname)) {
        document.documentElement.style.removeProperty("--zh-quick-nav-h");
        document
          .querySelectorAll<HTMLElement>(".zh-quick-nav, .zh-quick-nav-wrap")
          .forEach((el) => {
            if (!el.closest(".zh-page")) el.style.display = "none";
          });
      }
      publishStickyChromeStack(measureStickyChromeStack());
    };

    // Do NOT sync on every scroll frame — rewriting CSS vars mid-scroll
    // made the sticky stack resize and cards flash under the black bar.
    sync();
    const raf = window.requestAnimationFrame(sync);
    const t1 = window.setTimeout(sync, 50);
    const t2 = window.setTimeout(sync, 250);

    const resizeObserver = new ResizeObserver(sync);
    const observeAll = () => {
      document.querySelectorAll("[data-sticky-chrome]").forEach((el) => {
        resizeObserver.observe(el);
      });
    };
    observeAll();

    const mutationObserver = new MutationObserver(() => {
      observeAll();
      sync();
    });
    // Do NOT watch `class` — `.zh-quick-nav.is-sticky` must not remeasure clearance mid-scroll.
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-sticky-chrome"],
    });

    window.addEventListener("resize", sync, { passive: true });
    document.addEventListener(STICKY_CHROME_EVENT, sync);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", sync);
      document.removeEventListener(STICKY_CHROME_EVENT, sync);
    };
  }, [pathname]);

  return null;
}
