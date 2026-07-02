"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ZORINO_QUICK_NAV_ITEMS,
  ZORINO_QUICK_NAV_SCROLL_PADDING,
  ZORINO_QUICK_NAV_STICKY_TOP,
  ZORINO_QUICK_NAV_TARGETS,
} from "@/lib/zorino-home/quick-nav-sections";
import "./quick-nav.css";

function getScrollOffset(navHeight: number) {
  return ZORINO_QUICK_NAV_STICKY_TOP + navHeight + ZORINO_QUICK_NAV_SCROLL_PADDING;
}

export default function ZorinoHomeQuickNav() {
  const navRef = useRef<HTMLElement>(null);
  const [navHeight, setNavHeight] = useState(52);
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

    const syncHeight = () => setNavHeight(node.offsetHeight);
    syncHeight();

    const resizeObserver = new ResizeObserver(syncHeight);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
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
        rootMargin: "-20% 0px -55% 0px",
        threshold: [0.08, 0.2, 0.35, 0.5],
      },
    );

    sections.forEach((section) => sectionObserver.observe(section));
    return () => sectionObserver.disconnect();
  }, []);

  const scrollToTarget = useCallback((targetId: string, itemId: string) => {
    const target = document.getElementById(targetId);
    if (!target) return;

    const navHeight = navRef.current?.offsetHeight ?? 52;
    const offset = getScrollOffset(navHeight);
    const top =
      target.getBoundingClientRect().top + window.scrollY - offset;

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
        aria-label="Quick section navigation"
      >
        <div className="zh-quick-nav__track">
          <div className="zh-quick-nav__row">
            {ZORINO_QUICK_NAV_ITEMS.map((item) => {
              const isActive = isItemActive(item);
              const className = `zh-quick-nav__pill${isActive ? " is-active" : ""}`;

              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={className}
                  >
                    <span className="zh-quick-nav__emoji" aria-hidden="true">
                      {item.emoji}
                    </span>
                    <span className="zh-quick-nav__label">{item.label}</span>
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
                  <span className="zh-quick-nav__label">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
