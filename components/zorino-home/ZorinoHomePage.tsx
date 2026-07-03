import "@/app/zorino-home.css";
import "@/components/zorino-home/hero-composition-lock.css";
import "@/components/zorino-home/homepage-surface.css";
import "@/components/zorino-home/homepage-premium.css";
import "@/components/deals/deals-page.css";
import "@/components/zorino-home/homepage-deals-preview.css";
import HomeHeroBackground from "@/components/zorino-home/HomeHeroBackground";
import ZorinoHomeNav from "@/components/zorino-home/ZorinoHomeNav";
import ZorinoHomeHero from "@/components/zorino-home/ZorinoHomeHero";
import ZorinoHomeSearch from "@/components/zorino-home/ZorinoHomeSearch";
import ZorinoHomeQuickNav from "@/components/zorino-home/ZorinoHomeQuickNav";
import ZorinoHomeFeaturedCouponBrands from "@/components/zorino-home/ZorinoHomeFeaturedCouponBrands";
import ZorinoHomeCategories from "@/components/zorino-home/ZorinoHomeCategories";
import ZorinoHomeDealsPanel from "@/components/zorino-home/ZorinoHomeDealsPanel";
import ZorinoHomeCouponsPanel from "@/components/zorino-home/ZorinoHomeCouponsPanel";
import ZorinoHomeProductSections from "@/components/zorino-home/ZorinoHomeProductSections";
import ZorinoHomeCtaBand from "@/components/zorino-home/ZorinoHomeCtaBand";
import ZorinoHomeFooter from "@/components/zorino-home/ZorinoHomeFooter";
import {
  getHeroFloatingProducts,
  getHomepageCategories,
  getHomepageSectionProducts,
  getHomepageStats,
  getPopularSearches,
  getTopCouponsForHomepage,
  getTrendingDeals,
} from "@/lib/data/homepage";
import { ZH_FEATURED_COUPON_BRANDS } from "@/lib/zorino-home/featured-coupon-brands";
import {
  withFallbackCategories,
  withFallbackCoupons,
  withFallbackDeals,
  withFallbackFloatingProducts,
  withFallbackFooterStats,
  withFallbackHeroStats,
  withFallbackPopularSearches,
  withFallbackSectionProducts,
} from "@/lib/zorino-home/presentation";

export default async function ZorinoHomePage() {
  const [deals, coupons, floatingProducts, categories, popularSearches, stats, sectionProducts] =
    await Promise.all([
      getTrendingDeals(8),
      getTopCouponsForHomepage(4),
      getHeroFloatingProducts(),
      getHomepageCategories(),
      getPopularSearches(),
      getHomepageStats(),
      getHomepageSectionProducts(),
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
        </div>

        <div className="zh-home-discovery-nav">
          <ZorinoHomeQuickNav />
          <div className="zh-categories-wrap">
            <ZorinoHomeCategories categories={withFallbackCategories(categories)} />
          </div>
        </div>

        <section className="zh-featured-brands-wrap" aria-label="Featured coupon brands">
          <ZorinoHomeFeaturedCouponBrands brands={[...ZH_FEATURED_COUPON_BRANDS]} />
        </section>

        <HomeHeroBackground>
          <section className="zh-commerce" aria-label="Trending deals and coupons">
            <ZorinoHomeDealsPanel deals={withFallbackDeals(deals)} />
            <ZorinoHomeCouponsPanel coupons={withFallbackCoupons(coupons)} />
          </section>
        </HomeHeroBackground>

        <section className="zh-product-sections-wrap" aria-label="Featured products">
          <ZorinoHomeProductSections
            sections={withFallbackSectionProducts(sectionProducts)}
          />
        </section>

        <section className="zh-cta-wrap" aria-label="Call to action">
          <ZorinoHomeCtaBand />
        </section>

        <section className="zh-footer-wrap">
          <ZorinoHomeFooter footerStats={withFallbackFooterStats(stats.footer)} />
        </section>
      </div>
    </div>
  );
}

