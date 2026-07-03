"use client";

import { TrendingUp, Zap, Percent, Sparkles } from "lucide-react";
import DealsDealCard from "@/components/deals/DealsDealCard";
import type { DealSectionId } from "@/components/deals/deal-sections";
import type { Deal } from "@/lib/types/entities";

const SECTION_META: Record<
  DealSectionId,
  { title: string; subtitle: string; icon: typeof TrendingUp }
> = {
  trending: {
    title: "Trending Deals",
    subtitle: "Most popular picks shoppers are saving on right now",
    icon: TrendingUp,
  },
  flash: {
    title: "Flash Deals",
    subtitle: "Limited-time offers ending soon — grab them before they expire",
    icon: Zap,
  },
  best: {
    title: "Best Discounts",
    subtitle: "Highest savings across every store on Zorino",
    icon: Percent,
  },
  recent: {
    title: "Recently Added",
    subtitle: "Fresh deals just landed in the marketplace",
    icon: Sparkles,
  },
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
  const meta = SECTION_META[sectionId];
  const Icon = meta.icon;

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
              {meta.title}
            </h2>
            <p className="zor-deals-page__section-subtitle">{meta.subtitle}</p>
          </div>
        </div>
        <span className="zor-deals-page__section-count">{deals.length} deals</span>
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
