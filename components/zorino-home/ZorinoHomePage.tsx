import "@/app/zorino-home.css";
import HomeHeroBackground from "@/components/zorino-home/HomeHeroBackground";
import ZorinoHomeNav from "@/components/zorino-home/ZorinoHomeNav";
import ZorinoHomeHero from "@/components/zorino-home/ZorinoHomeHero";
import ZorinoHomeSearch from "@/components/zorino-home/ZorinoHomeSearch";
import ZorinoHomeCategories from "@/components/zorino-home/ZorinoHomeCategories";
import ZorinoHomeDealsPanel from "@/components/zorino-home/ZorinoHomeDealsPanel";
import ZorinoHomeCouponsPanel from "@/components/zorino-home/ZorinoHomeCouponsPanel";
import ZorinoHomeFeatures from "@/components/zorino-home/ZorinoHomeFeatures";
import ZorinoHomeFooter from "@/components/zorino-home/ZorinoHomeFooter";
import {
  getHeroFloatingProducts,
  getHomepageCategories,
  getHomepageStats,
  getPopularSearches,
  getTopCouponsForHomepage,
  getTrendingDeals,
} from "@/lib/data/homepage";
import {
  withFallbackCategories,
  withFallbackCoupons,
  withFallbackDeals,
  withFallbackFloatingProducts,
  withFallbackFooterStats,
  withFallbackHeroStats,
  withFallbackPopularSearches,
} from "@/lib/zorino-home/presentation";

export default async function ZorinoHomePage() {
  const [deals, coupons, floatingProducts, categories, popularSearches, stats] =
    await Promise.all([
      getTrendingDeals(4),
      getTopCouponsForHomepage(4),
      getHeroFloatingProducts(),
      getHomepageCategories(),
      getPopularSearches(),
      getHomepageStats(),
    ]);

  return (
    <div className="zh-page">
      <ZorinoHomeNav />

      <div className="zh-shell">
        <HomeHeroBackground>
          <ZorinoHomeHero
            stats={withFallbackHeroStats(stats.hero)}
            floatingProducts={withFallbackFloatingProducts(floatingProducts)}
          />

          <div className="zh-hero-block__stack">
            <ZorinoHomeSearch
              popularSearches={withFallbackPopularSearches(popularSearches)}
            />
            <ZorinoHomeCategories
              categories={withFallbackCategories(categories)}
            />
          </div>

          <section className="zh-commerce" aria-label="Trending deals and coupons">
            <ZorinoHomeDealsPanel deals={withFallbackDeals(deals)} />
            <ZorinoHomeCouponsPanel coupons={withFallbackCoupons(coupons)} />
          </section>
        </HomeHeroBackground>

        <section className="zh-features-wrap" aria-label="Platform features">
          <ZorinoHomeFeatures />
        </section>

        <section className="zh-footer-wrap">
          <ZorinoHomeFooter footerStats={withFallbackFooterStats(stats.footer)} />
        </section>
      </div>
    </div>
  );
}
