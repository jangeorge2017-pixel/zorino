import ZorinoBlueprintNav from "@/components/zorino-blueprint/ZorinoBlueprintNav";
import ZorinoBlueprintHero from "@/components/zorino-blueprint/ZorinoBlueprintHero";
import ZorinoBlueprintSearch from "@/components/zorino-blueprint/ZorinoBlueprintSearch";
import ZorinoBlueprintCategories from "@/components/zorino-blueprint/ZorinoBlueprintCategories";
import ZorinoBlueprintDealsPanel from "@/components/zorino-blueprint/ZorinoBlueprintDealsPanel";
import ZorinoBlueprintCouponsPanel from "@/components/zorino-blueprint/ZorinoBlueprintCouponsPanel";
import ZorinoBlueprintFeatures from "@/components/zorino-blueprint/ZorinoBlueprintFeatures";
import ZorinoBlueprintFooter from "@/components/zorino-blueprint/ZorinoBlueprintFooter";
import {
  getTrendingDeals,
  getTopCouponsForHomepage,
  getHeroFloatingProducts,
  getHomepageCategories,
  getPopularSearches,
  getHomepageStats,
} from "@/lib/data/homepage";

/**
 * Blueprint: public/reference/zorino-final-design.png
 * Section order: Nav → Hero → Search → Categories → Deals|Coupons → Features → Footer
 */
export default async function ZorinoBlueprintPage() {
  const [deals, coupons, floating, categories, popularSearches, stats] =
    await Promise.all([
      getTrendingDeals(4),
      getTopCouponsForHomepage(4),
      getHeroFloatingProducts(),
      getHomepageCategories(),
      getPopularSearches(),
      getHomepageStats(),
    ]);

  return (
    <div className="zorino-blueprint">
      <ZorinoBlueprintNav />

      <div className="zb-shell">
        <section className="zb-hero-section" aria-label="Hero">
          <ZorinoBlueprintHero stats={stats.hero} floating={floating} />
        </section>

        <section className="zb-discovery-section" aria-label="Search and categories">
          <ZorinoBlueprintSearch popularSearches={popularSearches} defaultOpen />
          <ZorinoBlueprintCategories categories={categories} />
        </section>

        {(deals.length > 0 || coupons.length > 0) && (
          <section className="zb-commerce-section" aria-label="Trending deals and coupons">
            <div className="zb-commerce">
              <ZorinoBlueprintDealsPanel deals={deals} />
              <ZorinoBlueprintCouponsPanel coupons={coupons} />
            </div>
          </section>
        )}

        <section className="zb-features-section" aria-label="Platform features">
          <ZorinoBlueprintFeatures />
        </section>

        <section className="zb-footer-section">
          <ZorinoBlueprintFooter stats={stats.footer} />
        </section>
      </div>
    </div>
  );
}
