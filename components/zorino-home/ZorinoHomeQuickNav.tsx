"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ZORINO_QUICK_NAV_ITEMS,
  ZORINO_QUICK_NAV_TARGETS,
} from "@/lib/zorino-home/quick-nav-sections";
import { getStickyClearance } from "@/lib/sticky-chrome";
import "./quick-nav.css";

const LOCALES = ["en", "ar"] as const;

function isHomepage(pathname: string): boolean {
  if (pathname === "/") return true;
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments.length === 1 &&
    LOCALES.includes(segments[0] as (typeof LOCALES)[number])
  );
}

const QUICK_NAV_LABEL_KEYS: Record<string, string> = {
  "featured-brands": "quickCouponBrands",
  "trending-deals": "quickTrendingDeals",
  coupons: "quickCoupons",
  "flash-deals": "quickFlashDeals",
  "price-drops": "quickPriceDrops",
  "new-arrivals": "quickNewArrivals",
  "top-rated": "quickTopRated",
  "editors-picks": "quickEditorsPicks",
  stores: "quickStores",
  blog: "quickBlog",
};

export default function ZorinoHomeQuickNav() {
  const t = useTranslations("home");
  const pathname = usePathname();
  const onHome = isHomepage(pathname);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [clickedItemId, setClickedItemId] = useState<string | null>(null);

  const targetToItemIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const item of ZORINO_QUICK_NAV_ITEMS) {
      const list = map.get(item.targetId) ?? [];
      list.push(item.id);
      map.set(item.targetId, list);
    }
    return map;
  }, []);

  useEffect(() => {
    if (!onHome) return;
    document.documentElement.style.removeProperty("--zh-quick-nav-h");
    document
      .querySelector(".zh-page")
      ?.style.removeProperty("--zh-quick-nav-h");
  }, [onHome]);

  useEffect(() => {
    if (!onHome) return;
    const sections = ZORINO_QUICK_NAV_TARGETS.map((id) =>
      document.getElementById(id),
    ).filter((node): node is HTMLElement => node !== null);
    if (sections.length === 0) return;

    const stickyOffset = getStickyClearance();
    const sectionObserver = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const topEntry = visible[0];
        if (topEntry?.target.id) {
          setActiveTargetId(topEntry.target.id);
          setClickedItemId(null);
        }
      },
      {
        rootMargin: `-${stickyOffset}px 0px -45% 0px`,
        threshold: [0.08, 0.2, 0.35, 0.5],
      },
    );
    sections.forEach((section) => sectionObserver.observe(section));
    return () => sectionObserver.disconnect();
  }, [onHome]);

  const scrollToTarget = useCallback((targetId: string, itemId: string) => {
    const section = document.getElementById(targetId);
    if (!section) return;
    // Scroll the section head (not just the text node) so the whole title
    // block clears the fixed navbar — padding above the <h2> must not sit under it.
    const target =
      section.querySelector<HTMLElement>(
        ".zh-trending-deals__head, .zh-section-head",
      ) ??
      section.querySelector<HTMLElement>(
        "#zh-deals-title, #zh-coupons-title, .zor-deals-page__section-title, .zh-section-head__title, h2",
      ) ??
      section;
    const offset = getStickyClearance();
    const top =
      target.getBoundingClientRect().top + window.scrollY - offset - 12;
    setClickedItemId(itemId);
    setActiveTargetId(targetId);
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, []);

  const onItemClick = useCallback(
    (item: (typeof ZORINO_QUICK_NAV_ITEMS)[number]) => {
      if (item.href) return;
      scrollToTarget(item.targetId, item.id);
    },
    [scrollToTarget],
  );

  const isItemActive = useCallback(
    (item: (typeof ZORINO_QUICK_NAV_ITEMS)[number]) => {
      if (clickedItemId === item.id) return true;
      if (activeTargetId !== item.targetId) return false;
      const siblings = targetToItemIds.get(item.targetId) ?? [];
      return siblings[0] === item.id;
    },
    [activeTargetId, clickedItemId, targetToItemIds],
  );

  const labelFor = (item: (typeof ZORINO_QUICK_NAV_ITEMS)[number]) => {
    const key = QUICK_NAV_LABEL_KEYS[item.id];
    return key ? t(key as "quickCoupons") : item.label;
  };

  if (!onHome) return null;

  return (
    <div className="zh-quick-nav-wrap">
      <nav className="zh-quick-nav" aria-label={t("quickNav")}>
        <div className="zh-quick-nav__track">
          <div className="zh-quick-nav__row">
            {ZORINO_QUICK_NAV_ITEMS.map((item) => {
              const isActive = isItemActive(item);
              const className = `zh-quick-nav__pill${isActive ? " is-active" : ""}`;
              const label = labelFor(item);
              if (item.href) {
                return (
                  <Link key={item.id} href={item.href} className={className}>
                    <span className="zh-quick-nav__emoji" aria-hidden="true">
                      {item.emoji}
                    </span>
                    <span className="zh-quick-nav__label">{label}</span>
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  type="button"
                  className={className}
                  aria-current={isActive ? "true" : undefined}
                  onClick={() => onItemClick(item)}
                >
                  <span className="zh-quick-nav__emoji" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className="zh-quick-nav__label">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
