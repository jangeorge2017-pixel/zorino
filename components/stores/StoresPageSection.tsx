"use client";

import { useTranslations } from "next-intl";
import { Globe, ShoppingBag, Star, Store as StoreIcon } from "lucide-react";
import StoresStoreCard from "@/components/stores/StoresStoreCard";
import type { StoreSectionId } from "@/components/stores/store-sections";
import type { Store } from "@/lib/types/entities";

const SECTION_ICONS: Record<StoreSectionId, typeof StoreIcon> = {
  featured: Star,
  marketplaces: ShoppingBag,
  partners: StoreIcon,
  global: Globe,
};

const SECTION_KEYS: Record<StoreSectionId, { title: string; subtitle: string }> = {
  featured: { title: "sectionFeaturedTitle", subtitle: "sectionFeaturedSubtitle" },
  marketplaces: { title: "sectionMarketplacesTitle", subtitle: "sectionMarketplacesSubtitle" },
  partners: { title: "sectionPartnersTitle", subtitle: "sectionPartnersSubtitle" },
  global: { title: "sectionGlobalTitle", subtitle: "sectionGlobalSubtitle" },
};

type StoresPageSectionProps = {
  sectionId: StoreSectionId;
  stores: Store[];
  viewProductsLabel: string;
};

export default function StoresPageSection({
  sectionId,
  stores,
  viewProductsLabel,
}: StoresPageSectionProps) {
  const t = useTranslations("stores");
  const keys = SECTION_KEYS[sectionId];
  const Icon = SECTION_ICONS[sectionId];

  return (
    <section
      className={`zor-stores-page__section zor-stores-page__section--${sectionId}`}
      aria-labelledby={`stores-section-${sectionId}`}
    >
      <header className="zor-stores-page__section-head">
        <div className="zor-stores-page__section-title-wrap">
          <span className="zor-stores-page__section-icon" aria-hidden>
            <Icon size={18} />
          </span>
          <div>
            <h2 id={`stores-section-${sectionId}`} className="zor-stores-page__section-title">
              {t(keys.title)}
            </h2>
            <p className="zor-stores-page__section-subtitle">{t(keys.subtitle)}</p>
          </div>
        </div>
        <span className="zor-stores-page__section-count">
          {t("sectionCount", { count: stores.length })}
        </span>
      </header>

      <div className="zor-stores-page__grid zor-stores-page__section-grid">
        {stores.map((store) => (
          <StoresStoreCard
            key={store.id}
            store={store}
            viewProductsLabel={viewProductsLabel}
          />
        ))}
      </div>
    </section>
  );
}
