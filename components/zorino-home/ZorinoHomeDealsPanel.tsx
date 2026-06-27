"use client";

import { useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import ZorinoHomeDealCard from "@/components/zorino-home/ZorinoHomeDealCard";
import type { TrendingDealCard } from "@/lib/types/entities";

type ZorinoHomeDealsPanelProps = {
  deals: TrendingDealCard[];
};

export default function ZorinoHomeDealsPanel({ deals }: ZorinoHomeDealsPanelProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: -1 | 1) => {
    const node = trackRef.current;
    if (!node) return;
    const card = node.querySelector(".zh-deal-card");
    const cardWidth = card instanceof HTMLElement ? card.offsetWidth : 280;
    node.scrollBy({ left: direction * (cardWidth + 14), behavior: "smooth" });
  };

  return (
    <section className="zh-panel" aria-labelledby="zh-deals-title">
      <div className="zh-section-head">
        <h2 id="zh-deals-title" className="zh-section-head__title">
          <span aria-hidden>🔥</span> Trending Deals
        </h2>
        <Link href="/deals" className="zh-section-head__link">
          View all deals →
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
            onClick={() => scroll(-1)}
          >
            <ChevronLeft size={18} />
          </button>
          <div className="zh-deals__track" ref={trackRef}>
            {deals.map((deal) => (
              <ZorinoHomeDealCard key={deal.id} deal={deal} />
            ))}
          </div>
          <button
            type="button"
            className="zh-deals__nav zh-deals__nav--next"
            aria-label="Next deals"
            onClick={() => scroll(1)}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </section>
  );
}
