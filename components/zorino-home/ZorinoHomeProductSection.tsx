import { getTranslations } from "next-intl/server";
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

const SECTION_TITLE_KEYS: Record<ZhHomeProductSection["key"], string> = {
  flash: "quickFlashDeals",
  priceDrops: "quickPriceDrops",
  newArrivals: "quickNewArrivals",
  topRated: "quickTopRated",
  editorsPicks: "quickEditorsPicks",
};

const SECTION_SUBTITLE_KEYS: Record<ZhHomeProductSection["key"], string> = {
  flash: "sectionFlashSubtitle",
  priceDrops: "sectionPriceDropsSubtitle",
  newArrivals: "sectionNewArrivalsSubtitle",
  topRated: "sectionTopRatedSubtitle",
  editorsPicks: "sectionEditorsSubtitle",
};

type ZorinoHomeProductSectionProps = {
  section: ZhHomeProductSection;
  products: TrendingDealCard[];
};

export default async function ZorinoHomeProductSection({
  section,
  products,
}: ZorinoHomeProductSectionProps) {
  const t = await getTranslations("home");
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
      <div className="zh-product-section__head">
        <header className="zor-deals-page__section-head zh-product-section__title-row">
          <div className="zor-deals-page__section-title-wrap">
            <span className="zor-deals-page__section-icon" aria-hidden>
              <Icon size={18} />
            </span>
            <div>
              <h2 id={titleId} className="zor-deals-page__section-title">
                {t(SECTION_TITLE_KEYS[section.key] as "quickFlashDeals")}
              </h2>
              <p className="zor-deals-page__section-subtitle">
                {t(SECTION_SUBTITLE_KEYS[section.key] as "sectionFlashSubtitle")}
              </p>
            </div>
          </div>
          <div className="zh-product-section__title-actions">
            <ZorinoHomeViewAllLink
              href={section.viewAllHref}
              variant={viewAllVariant}
            />
          </div>
        </header>
      </div>

      {products.length === 0 ? (
        <p className="zh-panel__empty">{t("emptyProducts")}</p>
      ) : (
        <div className="listing-products-grid zor-deals-page__grid zor-deals-page__section-grid">
          {products.map((product) => (
            <DealsDealCard
              key={product.id}
              deal={trendingDealToDeal(product)}
              endsInLabel={trendingDealEndsInLabel(product)}
              featuredLabel={t("featured")}
            />
          ))}
        </div>
      )}
    </section>
  );
}
