"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ZORINO_QUICK_NAV_DEFAULT_HEIGHT,
  ZORINO_QUICK_NAV_ITEMS,
  ZORINO_QUICK_NAV_STICKY_TOP,
  ZORINO_QUICK_NAV_TARGETS,
  getStickyScrollOffset,
} from "@/lib/zorino-home/quick-nav-sections";
import "./quick-nav.css";

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

function syncStickyCssVars(quickNavHeight: number) {
  const root = document.querySelector(".zh-page") as HTMLElement | null;
  const target = root ?? document.documentElement;
  const height = Math.max(quickNavHeight, ZORINO_QUICK_NAV_DEFAULT_HEIGHT);
  const clearance = getStickyScrollOffset(height);
  const nav =
    document.querySelector<HTMLElement>(".zh-nav") ||
    document.querySelector<HTMLElement>(".zor-nav");
  const navBottom =
    nav && (getComputedStyle(nav).position === "fixed" || getComputedStyle(nav).position === "sticky")
      ? Math.ceil(nav.getBoundingClientRect().bottom)
      : ZORINO_QUICK_NAV_STICKY_TOP;
  const stack = Math.max(navBottom + height, clearance);
  target.style.setProperty("--zh-quick-nav-h", `${height}px`);
  target.style.setProperty("--zh-sticky-stack", `${stack}px`);
  target.style.setProperty("--zh-sticky-clearance", `${clearance}px`);
  document.documentElement.style.setProperty("--zh-sticky-clearance", `${clearance}px`);
  document.documentElement.style.setProperty("--zor-sticky-clearance", `${clearance}px`);
}

export default function ZorinoHomeQuickNav() {
  const t = useTranslations("home");
  const navRef = useRef<HTMLElement>(null);
  const [navHeight, setNavHeight] = useState(ZORINO_QUICK_NAV_DEFAULT_HEIGHT);
  const [isSticky, setIsSticky] = useState(false);
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
    const node = navRef.current;
    if (!node) return;
    const syncHeight = () => {
      const height = node.offsetHeight;
      setNavHeight(height);
      syncStickyCssVars(height);
    };
    syncHeight();
    const resizeObserver = new ResizeObserver(syncHeight);
    resizeObserver.observe(node);
    return () => {
      resizeObserver.disconnect();
      const root = document.querySelector(".zh-page") as HTMLElement | null;
      root?.style.removeProperty("--zh-quick-nav-h");
      root?.style.removeProperty("--zh-sticky-stack");
      root?.style.removeProperty("--zh-sticky-clearance");
      document.documentElement.style.removeProperty("--zh-sticky-clearance");
    };
  }, []);

  useEffect(() => {
    const anchor = document.querySelector(".zh-home-discovery-nav");
    if (!anchor) return;
    const onScroll = () => {
      const bottom = anchor.getBoundingClientRect().bottom;
      setIsSticky(bottom <= ZORINO_QUICK_NAV_STICKY_TOP + 4);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  useEffect(() => {
    const sections = ZORINO_QUICK_NAV_TARGETS.map((id) =>
      document.getElementById(id),
    ).filter((node): node is HTMLElement => node !== null);
    if (sections.length === 0) return;

    const stickyOffset = getStickyScrollOffset(navHeight);
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
        /* Treat the sticky stack as outside the active observation band */
        rootMargin: `-${stickyOffset}px 0px -45% 0px`,
        threshold: [0.08, 0.2, 0.35, 0.5],
      },
    );
    sections.forEach((section) => sectionObserver.observe(section));
    return () => sectionObserver.disconnect();
  }, [navHeight]);

  const scrollToTarget = useCallback((targetId: string, itemId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    const height = navRef.current?.offsetHeight ?? navHeight;
    const offset = getStickyScrollOffset(height);
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    setClickedItemId(itemId);
    setActiveTargetId(targetId);
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [navHeight]);

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

  return (
    <div className="zh-quick-nav-wrap">
      {isSticky ? (
        <div
          className="zh-quick-nav__placeholder"
          style={{ height: navHeight }}
          aria-hidden="true"
        />
      ) : null}
      <nav
        ref={navRef}
        className={`zh-quick-nav${isSticky ? " is-sticky" : ""}`}
        aria-label={t("quickNav")}
      >
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
