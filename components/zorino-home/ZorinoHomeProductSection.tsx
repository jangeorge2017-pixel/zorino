import ZorinoHomeViewAllLink from "@/components/zorino-home/ZorinoHomeViewAllLink";
import DealsDealCard from "@/components/deals/DealsDealCard";
import { ZH_HOME_SECTION_META } from "@/lib/zorino-home/home-section-meta";
import type { ZhHomeProductSection } from "@/lib/zorino-home/sections";
import {
  trendingDealEndsInLabel,
  trendingDealToDeal,
} from "@/lib/zorino-home/trending-deal-to-deal";
import type { TrendingDealCard } from "@/lib/types/entities";
import "./zorino-home-product-sections.css";

type ZorinoHomeProductSectionProps = {
  section: ZhHomeProductSection;
  products: TrendingDealCard[];
};

export default function ZorinoHomeProductSection({
  section,
  products,
}: ZorinoHomeProductSectionProps) {
  const titleId = `${section.targetId}-title`;
  const meta = ZH_HOME_SECTION_META[section.key];
  const Icon = meta.icon;

  const viewAllVariant =
    section.key === "flash" || section.key === "priceDrops" ? "deals" : "products";

  return (
    <section
      className={`zh-panel zh-product-section zh-deals-preview zor-deals-page zor-deals-page__section zor-deals-page__section--${meta.sectionClass}`}
      id={section.targetId}
      aria-labelledby={titleId}
    >
      <header className="zor-deals-page__section-head">
        <div className="zor-deals-page__section-title-wrap">
          <span className="zor-deals-page__section-icon" aria-hidden>
            <Icon size={18} />
          </span>
          <div>
            <h2 id={titleId} className="zor-deals-page__section-title">
              {section.title}
            </h2>
            <p className="zor-deals-page__section-subtitle">{meta.subtitle}</p>
          </div>
        </div>
        <ZorinoHomeViewAllLink href={section.viewAllHref} variant={viewAllVariant} />
      </header>

      {products.length === 0 ? (
        <p className="zh-panel__empty">No products in this section right now. Check back soon.</p>
      ) : (
        <div className="listing-products-grid zor-deals-page__grid zor-deals-page__section-grid">
          {products.map((product) => (
            <DealsDealCard
              key={product.id}
              deal={trendingDealToDeal(product)}
              endsInLabel={trendingDealEndsInLabel(product)}
              featuredLabel="Featured"
            />
          ))}
        </div>
      )}
    </section>
  );
}
