"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  ZORINO_QUICK_NAV_ITEMS,
  ZORINO_QUICK_NAV_TARGETS,
} from "@/lib/zorino-home/quick-nav-sections";
import {
  getStickyClearance,
  measureStickyChromeStack,
  notifyStickyChromeChanged,
} from "@/lib/sticky-chrome";
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

function primaryNavBottom(): number {
  const primary = document.querySelector<HTMLElement>(
    '[data-sticky-chrome="primary"]',
  );
  if (!primary) return measureStickyChromeStack().navHeight;
  return Math.ceil(primary.getBoundingClientRect().bottom);
}

export default function ZorinoHomeQuickNav() {
  const t = useTranslations("home");
  const navRef = useRef<HTMLElement>(null);
  const [navHeight, setNavHeight] = useState(0);
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
      const height = Math.ceil(node.getBoundingClientRect().height);
      setNavHeight(height);
      // Layout-only token for quick-nav self height — clearance comes from global system.
      document.documentElement.style.setProperty("--zh-quick-nav-h", `${height}px`);
      const page = document.querySelector(".zh-page") as HTMLElement | null;
      page?.style.setProperty("--zh-quick-nav-h", `${height}px`);
      notifyStickyChromeChanged();
    };
    syncHeight();
    const resizeObserver = new ResizeObserver(syncHeight);
    resizeObserver.observe(node);
    return () => {
      resizeObserver.disconnect();
      document.documentElement.style.removeProperty("--zh-quick-nav-h");
      const page = document.querySelector(".zh-page") as HTMLElement | null;
      page?.style.removeProperty("--zh-quick-nav-h");
    };
  }, []);

  useEffect(() => {
    const onScroll = () => {
      const node = navRef.current;
      if (!node) return;
      const threshold = primaryNavBottom();
      setIsSticky((prev) => {
        let next: boolean;
        if (prev) {
          const placeholder = document.querySelector<HTMLElement>(
            ".zh-quick-nav__placeholder",
          );
          next = placeholder
            ? placeholder.getBoundingClientRect().top <= threshold + 4
            : true;
        } else {
          next = node.getBoundingClientRect().top <= threshold + 4;
        }
        if (prev !== next) {
          queueMicrotask(() => notifyStickyChromeChanged());
        }
        return next;
      });
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
    // Re-measure global stack after pin state changes.
    notifyStickyChromeChanged();
  }, [isSticky, navHeight]);

  useEffect(() => {
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
  }, [navHeight, isSticky]);

  const scrollToTarget = useCallback((targetId: string, itemId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    // Predicted stack (primary + secondary) — secondary may not be pinned yet.
    notifyStickyChromeChanged();
    const offset = getStickyClearance();
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    setClickedItemId(itemId);
    setActiveTargetId(targetId);
    window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });

    // After smooth scroll settles and secondary pins, correct any residual cover.
    window.setTimeout(() => {
      notifyStickyChromeChanged();
      const liveOffset = getStickyClearance();
      const rect = target.getBoundingClientRect();
      if (rect.top < liveOffset) {
        window.scrollTo({
          top: Math.max(0, rect.top + window.scrollY - liveOffset),
          behavior: "auto",
        });
      }
    }, 500);
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

  return (
    <div className="zh-quick-nav-wrap">
      {isSticky ? (
        <div
          className="zh-quick-nav__placeholder"
          style={{ height: navHeight || undefined }}
          aria-hidden="true"
        />
      ) : null}
      <nav
        ref={navRef}
        data-sticky-chrome="secondary"
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
