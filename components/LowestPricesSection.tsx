"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DollarSign, ExternalLink, Sparkles, TrendingDown } from "lucide-react";
import AssetImage from "@/components/AssetImage";
import { LOWEST_PRICE_SORT_OPTIONS } from "@/lib/lowest-prices/config";
import type { LowestPriceSort, LowestPriceTodayItem } from "@/lib/types/entities";

type LowestPricesSectionProps = {
  items: LowestPriceTodayItem[];
  lastComputedAt?: string | null;
};

export default function LowestPricesSection({ items, lastComputedAt }: LowestPricesSectionProps) {
  const [sort, setSort] = useState<LowestPriceSort>("lowest_price");

  const sorted = useMemo(() => {
    const copy = [...items];
    if (sort === "biggest_discount") {
      return copy.sort((a, b) => b.discountPercent - a.discountPercent);
    }
    if (sort === "new_lowest") {
      return copy.sort((a, b) => {
        if (a.isNewLow !== b.isNewLow) return a.isNewLow ? -1 : 1;
        const aTime = a.priceRecordedAt ? new Date(a.priceRecordedAt).getTime() : 0;
        const bTime = b.priceRecordedAt ? new Date(b.priceRecordedAt).getTime() : 0;
        return bTime - aTime;
      });
    }
    return copy.sort((a, b) => a.lowestPrice - b.lowestPrice);
  }, [items, sort]);

  return (
    <section className="lowest-prices-section" aria-labelledby="lowest-prices-heading">
      <div className="lowest-prices-header">
        <div>
          <h2 id="lowest-prices-heading" className="section-title lowest-prices-title">
            <DollarSign size={24} className="lowest-prices-icon" />
            Lowest Prices Today
          </h2>
          <p className="lowest-prices-subtitle">
            Cheapest offers across all imported stores — compared automatically
          </p>
        </div>
        {lastComputedAt && (
          <p className="lowest-prices-updated">
            Updated {formatRelativeTime(lastComputedAt)}
          </p>
        )}
      </div>

      <div className="lowest-prices-sort-scroll">
        <div className="lowest-prices-sort" role="group" aria-label="Sort lowest prices">
          {LOWEST_PRICE_SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`lowest-sort-btn ${sort === option.value ? "lowest-sort-btn-active" : ""}`}
              onClick={() => setSort(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="lowest-prices-empty">No price data available yet.</p>
      ) : (
        <div className="lowest-prices-grid">
          {sorted.map((item) => (
            <LowestPriceCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function LowestPriceCard({ item }: { item: LowestPriceTodayItem }) {
  const shopUrl = item.affiliateUrl || item.externalUrl || `/product/${item.productId}`;

  return (
    <article className="lowest-price-card">
      <div className="lowest-price-card-top">
        <div className="lowest-price-badges">
          {item.isNewLow && (
            <span className="lowest-badge lowest-badge-new">
              <Sparkles size={12} />
              New Low
            </span>
          )}
          {item.discountPercent > 0 && (
            <span className="lowest-badge lowest-badge-save">-{item.discountPercent}%</span>
          )}
        </div>
        <AssetImage
          src={item.imageUrl}
          alt=""
          width={72}
          height={72}
          className="lowest-price-img"
          fallback={<span className="lowest-price-emoji">{item.emoji}</span>}
        />
      </div>

      <h3 className="lowest-price-name">{item.productName}</h3>

      <div className="lowest-price-row">
        <span className="lowest-price-current">${item.lowestPrice.toLocaleString("en-US")}</span>
        {item.originalPrice > item.lowestPrice && (
          <span className="lowest-price-original">${item.originalPrice.toLocaleString("en-US")}</span>
        )}
      </div>

      {item.savingsAmount > 0 && (
        <p className="lowest-price-savings">
          <TrendingDown size={12} />
          Save ${item.savingsAmount.toLocaleString("en-US")} ({item.discountPercent}%)
        </p>
      )}

      <div className="lowest-price-store">
        <span className="lowest-price-store-name">{item.storeName}</span>
        <span className="lowest-price-provider">{item.provider}</span>
      </div>

      <div className="lowest-price-actions">
        <Link href={`/product/${item.productId}`} className="lowest-price-details">
          Details
        </Link>
        <a
          href={shopUrl}
          target="_blank"
          rel="noopener noreferrer sponsored"
          className="lowest-price-shop"
        >
          Shop now
          <ExternalLink size={14} />
        </a>
      </div>
    </article>
  );
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.round(diff / 60_000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
