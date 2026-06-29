"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import ZorinoHomeDealCard from "@/components/zorino-home/ZorinoHomeDealCard";
import type { TrendingDealCard } from "@/lib/types/entities";
import "./zorino-home-deals.css";

type ZorinoHomeDealsPanelProps = {
  deals: TrendingDealCard[];
};

export default function ZorinoHomeDealsPanel({ deals }: ZorinoHomeDealsPanelProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncButtons = useCallback(() => {
    const node = trackRef.current;
    if (!node) return;
    setCanScrollLeft(node.scrollLeft > 4);
    setCanScrollRight(node.scrollLeft < node.scrollWidth - node.clientWidth - 4);
  }, []);

  useEffect(() => {
    syncButtons();
    window.addEventListener("resize", syncButtons);
    return () => window.removeEventListener("resize", syncButtons);
  }, [deals.length, syncButtons]);

  const scroll = (direction: -1 | 1) => {
    const node = trackRef.current;
    if (!node) return;
    const card = node.querySelector(".zh-deal-card");
    const cardWidth = card instanceof HTMLElement ? card.offsetWidth : 280;
    node.scrollBy({ left: direction * (cardWidth + 14), behavior: "smooth" });
    window.setTimeout(syncButtons, 420);
  };

  return (
    <section className="zh-panel zh-deals-panel" aria-labelledby="zh-deals-title">
      <div className="zh-section-head">
        <h2 id="zh-deals-title" className="zh-section-head__title">
          <span aria-hidden>🔥</span> Trending Deals
        </h2>
        <Link href="/deals" className="zh-section-head__link">
          View all deals
          <ChevronDown size={14} aria-hidden />
        </Link>
      </div>

      {deals.length === 0 ? (
        <p className="zh-panel__empty">No trending deals right now. Check back soon.</p>
      ) : (
        <div className="zh-deals">
          <button
            type="button"
            className="zh-deals__nav zh-deals__nav--prev"
            aria-label="Previous deals"
            disabled={!canScrollLeft}
            onClick={() => scroll(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <div
            className="zh-deals__track"
            ref={trackRef}
            onScroll={syncButtons}
          >
            {deals.map((deal) => (
              <ZorinoHomeDealCard key={deal.id} deal={deal} />
            ))}
          </div>
          <button
            type="button"
            className="zh-deals__nav zh-deals__nav--next"
            aria-label="Next deals"
            disabled={!canScrollRight}
            onClick={() => scroll(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
