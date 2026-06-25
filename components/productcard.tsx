import Link from "next/link";
import { Star, TrendingDown, ChevronRight } from "lucide-react";
import AssetImage from "@/components/AssetImage";
import SectionFlameIcon from "@/components/SectionFlameIcon";
import TrendingBadgePill from "@/components/TrendingBadge";
import { ComparePricesButton } from "@/components/PriceComparisonTable";
import { getTrendingDeals } from "@/lib/data/homepage";
import { getProductBadgesMap } from "@/services/trending/queries";
import type { TrendingDealCard } from "@/lib/types/entities";

function PriceSparkline({ data, id }: { data: number[]; id: number | string }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const gradientId = `sparkline-gradient-${id}`;
  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="price-sparkline" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DealCard({ deal }: { deal: TrendingDealCard }) {
  return (
    <article className="deal-card">
      <div className="deal-card-top">
        <div className="trending-card-badges">
          {deal.badge && <TrendingBadgePill badge={deal.badge} size="sm" />}
          <span className="deal-discount">-{deal.discount}%</span>
        </div>
        <div className="deal-image">
          <AssetImage
            src={deal.imageSrc}
            alt=""
            width={72}
            height={72}
            className="deal-product-img"
            fallback={<span className="deal-emoji">{deal.emoji}</span>}
          />
        </div>
      </div>
      <h3 className="deal-name">{deal.name}</h3>

      <div className="deal-rating">
        <div className="deal-stars">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              size={13}
              className={i < Math.floor(deal.rating) ? "star-filled" : "star-empty"}
              fill={i < Math.floor(deal.rating) ? "currentColor" : "none"}
            />
          ))}
        </div>
        <span className="deal-reviews">({deal.reviews.toLocaleString("en-US")})</span>
      </div>

      <div className="deal-price-drop">
        <TrendingDown size={12} />
        Price dropped
      </div>

      <div className="deal-pricing">
        <span className="deal-price">${deal.price.toLocaleString("en-US")}</span>
        <span className="deal-original">${deal.originalPrice.toLocaleString("en-US")}</span>
      </div>

      <div className="deal-store-row">
        <div className="deal-store">
          <span className="store-logo">
            <AssetImage
              src={deal.storeLogoSrc}
              alt=""
              width={28}
              height={28}
              className="store-logo-img"
              fallback={<span className="store-logo-initial">{deal.storeInitial}</span>}
            />
          </span>
          <span>{deal.store}</span>
        </div>
        <span className="deal-updated">Updated {deal.updatedMins} min ago</span>
      </div>

      <div className="deal-chart-row">
        <PriceSparkline data={deal.priceHistory} id={deal.id} />
      </div>

      <ComparePricesButton productId={String(deal.productId ?? deal.id)} />
    </article>
  );
}

export default async function ProductCard() {
  const deals = await getTrendingDeals();
  const productIds = deals.map((d) => String(d.productId ?? d.id));
  const badges = await getProductBadgesMap(productIds);
  const dealsWithBadges = deals.map((deal) => ({
    ...deal,
    badge: badges.get(String(deal.productId ?? deal.id)) ?? deal.badge ?? null,
  }));

  if (deals.length === 0) {
    return null;
  }

  return (
    <section className="trending-section">
      <div className="section-header">
        <h2 className="section-title">
          <SectionFlameIcon size={24} />
          Trending Deals
        </h2>
        <Link href="/deals" className="section-link">
          View all deals
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="deals-grid">
        {dealsWithBadges.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </section>
  );
}
