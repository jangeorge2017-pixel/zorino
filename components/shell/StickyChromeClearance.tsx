"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  STICKY_CHROME_EVENT,
  measureStickyChromeStack,
  publishStickyChromeStack,
} from "@/lib/sticky-chrome";

/**
 * Single global owner of sticky scroll clearance.
 * Measures every [data-sticky-chrome] layer and publishes --zor-sticky-clearance.
 */
export default function StickyChromeClearance() {
  const pathname = usePathname();

  useEffect(() => {
    const sync = () => {
      publishStickyChromeStack(measureStickyChromeStack());
    };

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
    mutationObserver.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-sticky-chrome"],
    });

    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync, { passive: true });
    document.addEventListener(STICKY_CHROME_EVENT, sync);

    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("scroll", sync);
      window.removeEventListener("resize", sync);
      document.removeEventListener(STICKY_CHROME_EVENT, sync);
    };
  }, [pathname]);

  return null;
}
