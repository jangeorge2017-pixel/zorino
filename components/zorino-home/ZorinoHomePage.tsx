import "@/app/zorino-home.css";
import "@/components/zorino-home/hero-composition-lock.css";
import "@/components/zorino-home/homepage-surface.css";
import "@/components/zorino-home/homepage-premium.css";
import "@/components/deals/deals-page.css";
import "@/components/zorino-home/homepage-deals-preview.css";
import "@/components/zorino-home/homepage-refinements.css";
import "@/components/zorino-home/homepage-visual-polish.css";
import "@/components/zorino-home/homepage-visual-lock.css";
import "@/app/badge-amber.css";
import { Suspense } from "react";
import HomeHeroBackground from "@/components/zorino-home/HomeHeroBackground";
import HeroArtwork from "@/components/zorino-home/HeroArtwork";
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
  getPopularSearchesLive,
  getPopularSearchesStatic,
  getTopCouponsForHomepage,
  getTrendingDeals,
} from "@/lib/data/homepage";
import { ZH_FEATURED_COUPON_BRANDS } from "@/lib/zorino-home/featured-coupon-brands";

/**
 * Hero orbit artwork depends on the live merged catalog (the slowest data
 * source). Streaming it keeps that fetch off the above-the-fold critical path;
 * the fallback is the artwork's own empty state, so nothing shifts (orbit cards
 * are absolutely positioned).
 */
async function HeroArtworkSection() {
  const floatingProducts = await getHeroFloatingProducts();
  return <HeroArtwork floatingProducts={floatingProducts} />;
}

/** Trending deals + top coupons — streamed so they never block first paint. */
async function CommerceSection() {
  const [deals, coupons] = await Promise.all([
    getTrendingDeals(8),
    getTopCouponsForHomepage(4),
  ]);

  return (
    <>
      <ZorinoHomeDealsPanel deals={deals} />
      <ZorinoHomeCouponsPanel coupons={coupons} />
    </>
  );
}

/** Below-the-fold product grids — streamed independently of the shell. */
async function ProductSectionsContent() {
  const sectionProducts = await getHomepageSectionProducts();
  return <ZorinoHomeProductSections sections={sectionProducts} />;
}

/** Search bar — live popular terms stream in without blocking the shell. */
async function SearchSection() {
  const popularSearches = await getPopularSearchesLive();
  return <ZorinoHomeSearch popularSearches={popularSearches} />;
}

export default async function ZorinoHomePage() {
  // Only fast, cached, above-the-fold data is on the critical path. Everything
  // that depends on the live marketplace catalog streams in via <Suspense>.
  const [stats, categories] = await Promise.all([
    getHomepageStats(),
    getHomepageCategories(),
  ]);

  return (
    <div className="zh-page">
      <div className="zh-page__background" aria-hidden="true" />
      <div className="zh-page__artwork-clip" aria-hidden="true">
        <div className="zh-page__artwork" />
      </div>
      <ZorinoHomeNav />

      <div className="zh-shell">
        <div className="zh-hero-zone">
          <ZorinoHomeHero
            stats={stats.hero}
            artworkSlot={
              <Suspense fallback={<HeroArtwork floatingProducts={[]} />}>
                <HeroArtworkSection />
              </Suspense>
            }
          />

          <div className="zh-hero-search">
            <Suspense
              fallback={<ZorinoHomeSearch popularSearches={getPopularSearchesStatic()} />}
            >
              <SearchSection />
            </Suspense>
          </div>
        </div>

        <div className="zh-home-discovery-nav">
          <ZorinoHomeQuickNav />
          <div className="zh-categories-wrap">
            <ZorinoHomeCategories categories={categories} />
          </div>
        </div>

        <HomeHeroBackground>
          <section className="zh-commerce" aria-label="Trending deals and coupons">
            <Suspense
              fallback={
                <>
                  <div className="zh-panel" aria-hidden style={{ minHeight: 560 }} />
                  <div className="zh-panel" aria-hidden style={{ minHeight: 560 }} />
                </>
              }
            >
              <CommerceSection />
            </Suspense>
          </section>
        </HomeHeroBackground>

        <section className="zh-featured-brands-wrap" aria-label="Featured coupon brands">
          <ZorinoHomeFeaturedCouponBrands brands={[...ZH_FEATURED_COUPON_BRANDS]} />
        </section>

        <section className="zh-product-sections-wrap" aria-label="Featured products">
          <Suspense
            fallback={
              <div className="zh-product-sections" aria-hidden style={{ minHeight: 900 }} />
            }
          >
            <ProductSectionsContent />
          </Suspense>
        </section>

        <section className="zh-cta-wrap" aria-label="Call to action">
          <ZorinoHomeCtaBand />
        </section>

        <section className="zh-footer-wrap">
          <ZorinoHomeFooter footerStats={stats.footer} />
        </section>
      </div>
    </div>
  );
}
