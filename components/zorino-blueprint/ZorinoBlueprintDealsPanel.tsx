"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import ZorinoBlueprintDealCard from "@/components/zorino-blueprint/ZorinoBlueprintDealCard";
import type { TrendingDealCard } from "@/lib/types/entities";

type Props = {
  deals: TrendingDealCard[];
};

export default function ZorinoBlueprintDealsPanel({ deals }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: -1 | 1) => {
    const node = trackRef.current;
    if (!node) return;
    const card = node.querySelector(".zb-deal-card");
    const cardWidth = card instanceof HTMLElement ? card.offsetWidth : 280;
    node.scrollBy({ left: direction * (cardWidth + 14), behavior: "smooth" });
  };

  if (deals.length === 0) return null;

  return (
    <section className="zb-panel" aria-labelledby="zb-deals-title">
      <div className="zb-section-head">
        <h2 id="zb-deals-title" className="zb-section-title">
          <span aria-hidden>🔥</span> Trending Deals
        </h2>
        <Link href="/deals" className="zb-section-link">
          View all deals →
        </Link>
      </div>

      <div className="zb-deals-carousel">
        <button
          type="button"
          className="zb-deals-nav zb-deals-nav--prev"
          aria-label="Previous deals"
          onClick={() => scroll(-1)}
        >
          <ChevronLeft size={18} />
        </button>
        <div className="zb-deals-track" ref={trackRef}>
          {deals.map((deal) => (
            <ZorinoBlueprintDealCard key={deal.id} deal={deal} />
          ))}
        </div>
        <button
          type="button"
          className="zb-deals-nav zb-deals-nav--next"
          aria-label="Next deals"
          onClick={() => scroll(1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </section>
  );
}
