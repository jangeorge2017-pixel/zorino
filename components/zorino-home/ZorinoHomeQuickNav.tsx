"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Ticket } from "lucide-react";
import {
  ZORINO_QUICK_NAV_ITEMS,
  ZORINO_QUICK_NAV_TARGETS,
} from "@/lib/zorino-home/quick-nav-sections";
import { getStickyClearance } from "@/lib/sticky-chrome";
import { MOBILE_NORMAL_MQ } from "@/components/zorino-home/MobileNormalRowMore";
import "./quick-nav.css";

const LOCALES = ["en", "ar"] as const;
const TABLET_QUICK_NAV_MQ = "(min-width: 768px) and (max-width: 1279px)";
/** Tablet pager + Mobile Normal in-row more control */
const QUICK_NAV_PAGER_MQ = `${TABLET_QUICK_NAV_MQ}, ${MOBILE_NORMAL_MQ}`;

type TabletNavPage = "start" | "end";

function isHomepage(pathname: string): boolean {
  if (pathname === "/") return true;
  const segments = pathname.split("/").filter(Boolean);
  return (
    segments.length === 1 &&
    LOCALES.includes(segments[0] as (typeof LOCALES)[number])
  );
}

function isRtlRow(row: HTMLElement): boolean {
  return (
    document.documentElement.getAttribute("dir") === "rtl" ||
    getComputedStyle(row).direction === "rtl"
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

const TICKET_ITEM_IDS = new Set(["coupons", "featured-brands"]);

export default function ZorinoHomeQuickNav() {
  const t = useTranslations("home");
  const pathname = usePathname();
  const onHome = isHomepage(pathname);
  const [activeTargetId, setActiveTargetId] = useState<string | null>(null);
  const [clickedItemId, setClickedItemId] = useState<string | null>(null);
  /** Tablet pager: start = first 7 slots, end = remaining 3 */
  const [tabletPage, setTabletPage] = useState<TabletNavPage>("start");
  const rowRef = useRef<HTMLDivElement>(null);

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
      .querySelector<HTMLElement>(".zh-page")
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

  const syncTabletPageFromScroll = useCallback(() => {
    const row = rowRef.current;
    if (!row || !window.matchMedia(QUICK_NAV_PAGER_MQ).matches) {
      setTabletPage("start");
      return;
    }
    const max = row.scrollWidth - row.clientWidth;
    if (max <= 2) {
      setTabletPage("start");
      return;
    }
    const rtl = isRtlRow(row);
    const mid = max * 0.45;
    // Chromium RTL: start ≈ 0, more content toward negative scrollLeft
    const atEnd = rtl ? row.scrollLeft < -mid : row.scrollLeft > mid;
    setTabletPage(atEnd ? "end" : "start");
  }, []);

  useEffect(() => {
    if (!onHome) return;
    const row = rowRef.current;
    if (!row) return;

    syncTabletPageFromScroll();
    const onScroll = () => syncTabletPageFromScroll();
    const onResize = () => syncTabletPageFromScroll();
    row.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    const mq = window.matchMedia(QUICK_NAV_PAGER_MQ);
    mq.addEventListener("change", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(row);
    return () => {
      row.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      mq.removeEventListener("change", onResize);
      ro.disconnect();
    };
  }, [onHome, syncTabletPageFromScroll]);

  const scrollTabletToPage = useCallback((page: TabletNavPage) => {
    const row = rowRef.current;
    if (!row || !window.matchMedia(QUICK_NAV_PAGER_MQ).matches) return;
    const rtl = isRtlRow(row);
    const max = Math.max(0, row.scrollWidth - row.clientWidth);
    const left = page === "start" ? 0 : rtl ? -max : max;
    row.scrollTo({ left, behavior: "smooth" });
    setTabletPage(page);
  }, []);

  const onTabletPagerClick = useCallback(() => {
    scrollTabletToPage(tabletPage === "start" ? "end" : "start");
  }, [scrollTabletToPage, tabletPage]);

  const scrollToTarget = useCallback((targetId: string, itemId: string) => {
    const section = document.getElementById(targetId);
    if (!section) return;
    // Scroll the section head (not just the text node) so the whole title
    // block clears the fixed navbar — padding above the <h2> must not sit under it.
    const target =
      section.querySelector<HTMLElement>(
        ".zh-section-header, .zh-trending-deals__head, .zh-product-section__head, .zh-section-head",
      ) ??
      section.querySelector<HTMLElement>(
        "#zh-deals-title, #zh-coupons-title, .zh-section-header__title, .zor-deals-page__section-title, .zh-section-head__title, h2",
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

  const pagerIsBack = tabletPage === "end";

  return (
    <div className="zh-quick-nav-wrap">
      <nav className="zh-quick-nav" aria-label={t("quickNav")}>
        <div className="zh-quick-nav__track">
          <div className="zh-quick-nav__row" ref={rowRef}>
            {ZORINO_QUICK_NAV_ITEMS.map((item) => {
              const isActive = isItemActive(item);
              const isTicket = TICKET_ITEM_IDS.has(item.id);
              const className = `zh-quick-nav__pill${isActive ? " is-active" : ""}${isTicket ? " zh-quick-nav__pill--ticket" : ""}`;
              const label = labelFor(item);
              if (item.href) {
                return (
                  <Link key={item.id} href={item.href} className={className}>
                    <span className="zh-quick-nav__emoji" aria-hidden="true">
                      {item.emoji}
                    </span>
                    {isTicket && (
                      <Ticket
                        className="zh-quick-nav__icon-mobile"
                        size={11}
                        strokeWidth={2}
                        aria-hidden
                      />
                    )}
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
                  {isTicket && (
                    <Ticket
                      className="zh-quick-nav__icon-mobile"
                      size={11}
                      strokeWidth={2}
                      aria-hidden
                    />
                  )}
                  <span className="zh-quick-nav__label">{label}</span>
                </button>
              );
            })}
          </div>
          {/* Tablet-only: always-visible more ↔ back toggle (CSS-hidden elsewhere) */}
          <button
            type="button"
            className={`zh-quick-nav__more${pagerIsBack ? " is-back" : ""}`}
            aria-label={pagerIsBack ? t("quickNavBack") : t("quickNavMore")}
            onClick={onTabletPagerClick}
          >
            <svg
              className="zh-quick-nav__more-icon"
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
        </div>
      </nav>
    </div>
  );
}
