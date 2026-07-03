"use client";

import { BarChart3, DollarSign, Scale, TrendingUp } from "lucide-react";
import CompareProductCard from "@/components/compare/CompareProductCard";
import type { CompareSectionId } from "@/components/compare/compare-sections";
import type { CompareProductResult } from "@/services/compare";

const SECTION_META: Record<
  CompareSectionId,
  { title: string; subtitle: string; icon: typeof Scale }
> = {
  best_savings: {
    title: "Best Savings",
    subtitle: "Products with the biggest price gaps across stores",
    icon: TrendingUp,
  },
  lowest_prices: {
    title: "Lowest Prices",
    subtitle: "Top picks with the most competitive starting prices",
    icon: DollarSign,
  },
  most_stores: {
    title: "Most Store Options",
    subtitle: "Compare the widest selection of marketplace offers",
    icon: BarChart3,
  },
  trending: {
    title: "Trending Comparisons",
    subtitle: "Popular products shoppers compare most often",
    icon: Scale,
  },
};

type ComparePageSectionProps = {
  sectionId: CompareSectionId;
  products: CompareProductResult[];
};

export default function ComparePageSection({ sectionId, products }: ComparePageSectionProps) {
  const meta = SECTION_META[sectionId];
  const Icon = meta.icon;

  return (
    <section
      className={`zor-compare-page__section zor-compare-page__section--${sectionId}`}
      aria-labelledby={`compare-section-${sectionId}`}
    >
      <header className="zor-compare-page__section-head">
        <div className="zor-compare-page__section-title-wrap">
          <span className="zor-compare-page__section-icon" aria-hidden>
            <Icon size={18} />
          </span>
          <div>
            <h2 id={`compare-section-${sectionId}`} className="zor-compare-page__section-title">
              {meta.title}
            </h2>
            <p className="zor-compare-page__section-subtitle">{meta.subtitle}</p>
          </div>
        </div>
        <span className="zor-compare-page__section-count">{products.length} products</span>
      </header>

      <div className="zor-compare-page__stack zor-compare-page__section-stack">
        {products.map((item) => (
          <CompareProductCard key={`${sectionId}-${item.product.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}
