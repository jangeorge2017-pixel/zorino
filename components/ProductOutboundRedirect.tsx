"use client";

import { useEffect, useRef } from "react";

type ProductOutboundRedirectProps = {
  /** Absolute URL to the outbound affiliate route (/api/affiliate/go?...). */
  href: string;
};

/**
 * Client-side outbound redirect used when a marketplace genuinely cannot serve
 * an internal product-detail page (e.g. Amazon US/EG without API credentials).
 *
 * Navigating via the browser (`window.location.replace`) routes through the
 * existing /api/affiliate/go endpoint — which is excluded from the i18n proxy —
 * so the user lands on the REAL product URL with its existing affiliate tag.
 * This avoids next-intl rewriting a server-side `redirect()` into an internal
 * path (which would otherwise loop back into the product page).
 */
export default function ProductOutboundRedirect({ href }: ProductOutboundRedirectProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    window.location.replace(href);
  }, [href]);

  return null;
}
