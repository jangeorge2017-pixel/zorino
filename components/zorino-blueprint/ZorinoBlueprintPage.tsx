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
        <ZorinoBlueprintHero stats={stats.hero} floating={floating} />
        <ZorinoBlueprintSearch popularSearches={popularSearches} defaultOpen />
        <ZorinoBlueprintCategories categories={categories} />
        {(deals.length > 0 || coupons.length > 0) && (
          <div className="zb-commerce">
            <ZorinoBlueprintDealsPanel deals={deals} />
            <ZorinoBlueprintCouponsPanel coupons={coupons} />
          </div>
        )}
        <ZorinoBlueprintFeatures />
        <ZorinoBlueprintFooter stats={stats.footer} />
      </div>
    </div>
  );
}
