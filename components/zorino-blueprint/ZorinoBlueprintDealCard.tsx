"use client";

import Link from "next/link";
import { ChevronRight, Star, TrendingDown } from "lucide-react";
import ZorinoBlueprintSparkline from "@/components/zorino-blueprint/ZorinoBlueprintSparkline";
import type { TrendingDealCard } from "@/lib/types/entities";

type Props = {
  deal: TrendingDealCard;
};

export default function ZorinoBlueprintDealCard({ deal }: Props) {
  const productId = String(deal.productId ?? deal.id);
  const showDrop = deal.originalPrice > deal.price;

  return (
    <article className="zb-deal-card">
      <div className="zb-deal-media">
        {deal.discount > 0 ? (
          <span className="zb-deal-discount">-{Math.round(deal.discount)}%</span>
        ) : null}
        <img src={deal.imageSrc} alt={deal.name} />
      </div>

      <h3 className="zb-deal-name">{deal.name}</h3>

      <div className="zb-deal-rating">
        <span className="zb-stars" aria-label={`${deal.rating} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={12}
              fill={i < Math.round(deal.rating) ? "#fbbf24" : "none"}
              color="#fbbf24"
            />
          ))}
        </span>
        <span className="zb-deal-reviews">({deal.reviews.toLocaleString()})</span>
      </div>

      {showDrop ? (
        <span className="zb-price-drop">
          <TrendingDown size={12} aria-hidden />
          Price dropped
        </span>
      ) : null}

      <div className="zb-deal-prices">
        <span className="zb-deal-price">${deal.price.toLocaleString("en-US")}</span>
        {showDrop ? (
          <span className="zb-deal-was">
            ${deal.originalPrice.toLocaleString("en-US")}
          </span>
        ) : null}
      </div>

      <div className="zb-deal-store-row">
        <div className="zb-deal-store">
          <span className="zb-deal-store-logo">
            <img
              src={deal.storeLogoSrc}
              alt=""
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                if (target.parentElement) {
                  target.parentElement.textContent = deal.storeInitial;
                }
              }}
            />
          </span>
          {deal.store}
        </div>
        <span className="zb-deal-updated">Updated {deal.updatedMins} min ago</span>
      </div>

      {deal.priceHistory.length > 1 ? (
        <ZorinoBlueprintSparkline values={deal.priceHistory} />
      ) : null}

      <Link href={`/product/${productId}#compare-prices`} className="zb-compare-btn">
        Compare Prices
        <ChevronRight size={16} aria-hidden />
      </Link>
    </article>
  );
}
