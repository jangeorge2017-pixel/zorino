import "@/app/zorino-home.css";
import "@/components/zorino-home/hero-composition-lock.css";
import HomeHeroBackground from "@/components/zorino-home/HomeHeroBackground";
import ZorinoHomeNav from "@/components/zorino-home/ZorinoHomeNav";
import ZorinoHomeHero from "@/components/zorino-home/ZorinoHomeHero";
import ZorinoHomeQuickNav from "@/components/zorino-home/ZorinoHomeQuickNav";
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
    <div className="zh-page" dir="ltr">
      <div className="zh-page__background" aria-hidden="true" />
      <div className="zh-page__artwork" aria-hidden="true" />
      <ZorinoHomeNav />

      <div className="zh-shell">
        <div className="zh-hero-zone">
          <ZorinoHomeHero
            stats={withFallbackHeroStats(stats.hero)}
            floatingProducts={withFallbackFloatingProducts(floatingProducts)}
          />

          <div className="zh-hero-search">
            <ZorinoHomeSearch
              popularSearches={withFallbackPopularSearches(popularSearches)}
            />
          </div>

          <ZorinoHomeQuickNav />

          <ZorinoHomeCategories
            categories={withFallbackCategories(categories)}
          />
        </div>

        <HomeHeroBackground>
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
