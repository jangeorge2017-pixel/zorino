"use client";

import { useTranslations } from "next-intl";
import { BarChart3, DollarSign, Scale, TrendingUp } from "lucide-react";
import CompareProductCard from "@/components/compare/CompareProductCard";
import type { CompareSectionId } from "@/components/compare/compare-sections";
import type { CompareProductResult } from "@/services/compare";

const SECTION_META: Record<
  CompareSectionId,
  { title: string; subtitle: string; icon: typeof Scale }
> = {
  best_savings: {
    title: "sectionBestSavingsTitle",
    subtitle: "sectionBestSavingsSubtitle",
    icon: TrendingUp,
  },
  lowest_prices: {
    title: "sectionLowestPricesTitle",
    subtitle: "sectionLowestPricesSubtitle",
    icon: DollarSign,
  },
  most_stores: {
    title: "sectionMostStoresTitle",
    subtitle: "sectionMostStoresSubtitle",
    icon: BarChart3,
  },
  trending: {
    title: "sectionTrendingTitle",
    subtitle: "sectionTrendingSubtitle",
    icon: Scale,
  },
};

type ComparePageSectionProps = {
  sectionId: CompareSectionId;
  products: CompareProductResult[];
};

export default function ComparePageSection({ sectionId, products }: ComparePageSectionProps) {
  const t = useTranslations("compare");
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
              {t(meta.title)}
            </h2>
            <p className="zor-compare-page__section-subtitle">{t(meta.subtitle)}</p>
          </div>
        </div>
        <span className="zor-compare-page__section-count">{t("productsCount", { count: products.length })}</span>
      </header>

      <div className="zor-compare-page__stack zor-compare-page__section-stack">
        {products.map((item) => (
          <CompareProductCard key={`${sectionId}-${item.product.id}`} item={item} />
        ))}
      </div>
    </section>
  );
}
