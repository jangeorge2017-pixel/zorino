"use client";

import { Globe, ShoppingBag, Star, Store as StoreIcon } from "lucide-react";
import StoresStoreCard from "@/components/stores/StoresStoreCard";
import type { StoreSectionId } from "@/components/stores/store-sections";
import type { Store } from "@/lib/types/entities";

const SECTION_META: Record<
  StoreSectionId,
  { title: string; subtitle: string; icon: typeof StoreIcon }
> = {
  featured: {
    title: "Featured Marketplaces",
    subtitle: "Top-performing stores with the best commission rates",
    icon: Star,
  },
  marketplaces: {
    title: "Major Marketplaces",
    subtitle: "Shop from the world's leading e-commerce platforms",
    icon: ShoppingBag,
  },
  partners: {
    title: "Partner Stores",
    subtitle: "Verified brand partners with exclusive offers",
    icon: StoreIcon,
  },
  global: {
    title: "Global Stores",
    subtitle: "Marketplaces shipping across multiple regions",
    icon: Globe,
  },
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
  const meta = SECTION_META[sectionId];
  const Icon = meta.icon;

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
              {meta.title}
            </h2>
            <p className="zor-stores-page__section-subtitle">{meta.subtitle}</p>
          </div>
        </div>
        <span className="zor-stores-page__section-count">{stores.length} stores</span>
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
