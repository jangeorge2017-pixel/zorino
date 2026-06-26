"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Sparkles, TrendingDown } from "lucide-react";
import ProductCardMedia from "@/components/ProductCardMedia";
import ProductCardActions from "@/components/ProductCardActions";
import HomeSectionHeader from "@/components/HomeSectionHeader";
import { HOME_SECTIONS } from "@/lib/homepage/sections";
import { LOWEST_PRICE_SORT_OPTIONS } from "@/lib/lowest-prices/config";
import { buildAffiliateRedirectPath } from "@/lib/affiliate/generate";
import { trackProductInteraction } from "@/lib/trending/track-client";
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
    <section
      id={HOME_SECTIONS["lowest-price"].sectionId}
      className="home-section-shell home-section-shell--lowest-price lowest-prices-section"
      aria-labelledby="lowest-prices-heading"
    >
      <HomeSectionHeader
        variant="lowest-price"
        headingId="lowest-prices-heading"
        title="Lowest Prices Today"
        subtitle="Cheapest offers across all imported stores — compared automatically"
        meta={
          lastComputedAt ? (
            <p className="lowest-prices-updated">
              Updated {formatRelativeTime(lastComputedAt)}
            </p>
          ) : undefined
        }
      />

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
  const rawDestination = item.externalUrl || item.affiliateUrl || "";
  const destination = rawDestination.startsWith("http")
    ? rawDestination
    : `https://${item.provider}.com`;
  const shopUrl = buildAffiliateRedirectPath({
    productId: item.productId,
    storeSlug: item.provider,
    destinationUrl: destination,
    source: "lowest_prices_section",
    countryCode: item.countryCode,
  });
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current || !item.productId) return;
    tracked.current = true;
    trackProductInteraction({
      productId: item.productId,
      eventType: "view",
      countryCode: item.countryCode,
      source: "lowest_prices_section",
    });
  }, [item.productId, item.countryCode]);

  const handleShopClick = () => {
    if (!item.productId) return;
    trackProductInteraction({
      productId: item.productId,
      eventType: "click",
      countryCode: item.countryCode,
      source: "lowest_prices_section",
    });
  };

  return (
    <article className="lowest-price-card product-card">
      <ProductCardMedia
        src={item.imageUrl}
        alt={item.productName}
        fallback={<span className="lowest-price-emoji">{item.emoji}</span>}
        badges={
          <>
            {item.isNewLow && (
              <span className="lowest-badge lowest-badge-new">
                <Sparkles size={12} />
                New Low
              </span>
            )}
            {item.discountPercent > 0 && (
              <span className="lowest-badge lowest-badge-save">-{item.discountPercent}%</span>
            )}
          </>
        }
      />

      <div className="product-card-body">
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
      </div>

      <ProductCardActions
        productId={item.productId}
        compareClassName="lowest-price-details"
        shopHref={shopUrl}
        shopExternal
        onShopClick={handleShopClick}
      />
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
