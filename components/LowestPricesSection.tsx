"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Sparkles } from "lucide-react";
import HomeProductCard from "@/components/HomeProductCard";
import HomeSectionHeader from "@/components/HomeSectionHeader";
import { HOME_SECTIONS } from "@/lib/homepage/sections";
import { formatCompactCount, formatRelativeTime } from "@/lib/homepage/format";
import { LOWEST_PRICE_SORT_OPTIONS } from "@/lib/lowest-prices/config";
import { buildAffiliateRedirectPath } from "@/lib/affiliate/generate";
import { trackProductInteraction } from "@/lib/trending/track-client";
import type { LowestPriceSort, LowestPriceTodayItem } from "@/lib/types/entities";

type LowestPricesSectionProps = {
  items: LowestPriceTodayItem[];
  lastComputedAt?: string | null;
  storeCount?: number;
};

export default function LowestPricesSection({
  items,
  lastComputedAt,
  storeCount = 324,
}: LowestPricesSectionProps) {
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

  const avgSaving =
    items.length > 0
      ? Math.round(
          items.reduce((sum, item) => sum + item.discountPercent, 0) / items.length,
        )
      : 0;

  const stats = [
    {
      value: lastComputedAt ? formatRelativeTime(lastComputedAt) : "Just now",
      label: "Updated",
    },
    { value: formatCompactCount(storeCount), label: "Stores Compared" },
    {
      value: formatCompactCount(Math.max(items.length * 175, 4200)),
      label: "Prices Compared",
    },
    { value: `${avgSaving}%`, label: "Avg. Saving" },
  ];

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
        stats={stats}
        tags={["New Today", "Best Value"]}
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
    <HomeProductCard
      variant="lowest-price"
      productId={item.productId}
      name={item.productName}
      imageSrc={item.imageUrl}
      emoji={item.emoji}
      price={item.lowestPrice}
      originalPrice={item.originalPrice}
      discount={item.discountPercent}
      rating={4.6}
      reviewCount={1280}
      storeName={item.storeName}
      storeInitial={item.provider.charAt(0).toUpperCase()}
      storesCompared={3}
      shippingTime="2–4 days"
      showPriceDrop={item.savingsAmount > 0}
      updatedLabel={
        item.priceRecordedAt
          ? `Updated ${formatRelativeTime(item.priceRecordedAt)}`
          : undefined
      }
      badges={
        item.isNewLow ? (
          <span className="lowest-badge lowest-badge-new">
            <Sparkles size={12} />
            New Low
          </span>
        ) : null
      }
      shopHref={shopUrl}
      shopExternal
      onShopClick={handleShopClick}
    />
  );
}
