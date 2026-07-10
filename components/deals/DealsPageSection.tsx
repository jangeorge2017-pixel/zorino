"use client";

import { useTranslations } from "next-intl";
import { TrendingUp, Zap, Percent, Sparkles } from "lucide-react";
import DealsDealCard from "@/components/deals/DealsDealCard";
import type { DealSectionId } from "@/components/deals/deal-sections";
import type { Deal } from "@/lib/types/entities";

const SECTION_ICONS: Record<DealSectionId, typeof TrendingUp> = {
  trending: TrendingUp,
  flash: Zap,
  best: Percent,
  recent: Sparkles,
};

const SECTION_KEYS: Record<DealSectionId, { title: string; subtitle: string }> = {
  trending: { title: "sectionTrendingTitle", subtitle: "sectionTrendingSubtitle" },
  flash: { title: "sectionFlashTitle", subtitle: "sectionFlashSubtitle" },
  best: { title: "sectionBestTitle", subtitle: "sectionBestSubtitle" },
  recent: { title: "sectionRecentTitle", subtitle: "sectionRecentSubtitle" },
};

type DealsPageSectionProps = {
  sectionId: DealSectionId;
  deals: Deal[];
  endsInLabel: (deal: Deal) => string;
  featuredLabel?: string;
};

export default function DealsPageSection({
  sectionId,
  deals,
  endsInLabel,
  featuredLabel,
}: DealsPageSectionProps) {
  const t = useTranslations("deals");
  const keys = SECTION_KEYS[sectionId];
  const Icon = SECTION_ICONS[sectionId];

  return (
    <section
      className={`zor-deals-page__section zor-deals-page__section--${sectionId}`}
      aria-labelledby={`deals-section-${sectionId}`}
    >
      <header className="zor-deals-page__section-head">
        <div className="zor-deals-page__section-title-wrap">
          <span className="zor-deals-page__section-icon" aria-hidden>
            <Icon size={18} />
          </span>
          <div>
            <h2 id={`deals-section-${sectionId}`} className="zor-deals-page__section-title">
              {t(keys.title)}
            </h2>
            <p className="zor-deals-page__section-subtitle">{t(keys.subtitle)}</p>
          </div>
        </div>
        <span className="zor-deals-page__section-count">
          {t("sectionCount", { count: deals.length })}
        </span>
      </header>

      <div className="listing-products-grid zor-deals-page__grid zor-deals-page__section-grid">
        {deals.map((deal) => (
          <DealsDealCard
            key={deal.id}
            deal={deal}
            endsInLabel={endsInLabel(deal)}
            featuredLabel={featuredLabel}
          />
        ))}
      </div>
    </section>
  );
}
