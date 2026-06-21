import Link from "next/link";
import { Flame, Star, TrendingDown, ChevronRight } from "lucide-react";
import { trendingDeals } from "@/data/home";

function PriceSparkline({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const width = 80;
  const height = 28;
  const points = data
    .map((value, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="price-sparkline" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="url(#sparkline-gradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <defs>
        <linearGradient id="sparkline-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function DealCard({
  deal,
}: {
  deal: (typeof trendingDeals)[number];
}) {
  return (
    <article className="deal-card">
      <span className="deal-discount">-{deal.discount}%</span>

      <div className="deal-image">{deal.image}</div>

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
        <span className="deal-reviews">({deal.reviews.toLocaleString()})</span>
      </div>

      <div className="deal-price-drop">
        <TrendingDown size={12} />
        Price dropped
      </div>

      <div className="deal-pricing">
        <span className="deal-price">${deal.price.toLocaleString()}</span>
        <span className="deal-original">${deal.originalPrice.toLocaleString()}</span>
      </div>

      <div className="deal-store-row">
        <div className="deal-store">
          <span className="store-logo" style={{ background: deal.storeColor }}>
            {deal.store.charAt(0)}
          </span>
          <span>{deal.store}</span>
        </div>
        <div className="deal-chart">
          <PriceSparkline data={deal.priceHistory} />
          <span className="deal-updated">Updated {deal.updatedMins} min ago</span>
        </div>
      </div>

      <button type="button" className="deal-compare-btn">
        Compare Prices
      </button>
    </article>
  );
}

export default function ProductCard() {
  return (
    <section className="trending-section">
      <div className="section-header">
        <h2 className="section-title">
          <Flame size={24} className="section-icon-fire" />
          Trending Deals
        </h2>
        <Link href="/deals" className="section-link">
          View all deals
          <ChevronRight size={16} />
        </Link>
      </div>

      <div className="deals-grid">
        {trendingDeals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
      </div>
    </section>
  );
}
