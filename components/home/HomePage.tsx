import Navbar from "@/components/navbar";
import HeroContainer from "@/components/HeroContainer";
import SearchBarContainer from "@/components/SearchBarContainer";
import CategoryGridContainer from "@/components/CategoryGridContainer";
import HomeDealsCouponsRow from "@/components/HomeDealsCouponsRow";
import TrendingProductsContainer from "@/components/TrendingProductsContainer";
import LowestPricesContainer from "@/components/LowestPricesContainer";
import RecommendedProductsContainer from "@/components/RecommendedProductsContainer";
import PersonalizedRecommendationsContainer from "@/components/PersonalizedRecommendationsContainer";
import FeaturesSection from "@/components/FeaturesSection";
import FooterStatsContainer from "@/components/FooterStatsContainer";

/**
 * Reference layout — public/reference/zorino-final-design.png
 * Structure only; product imagery comes from integrated store APIs.
 */
export default function HomePage() {
  return (
    <main className="homepage homepage--reference home-structure">
      <header className="home-structure__header">
        <Navbar />
      </header>

      <div className="site-shell home-structure__body">
        <section className="home-structure__hero" aria-label="Hero">
          <div className="hero-zone">
            <HeroContainer />
          </div>
        </section>

        <section className="home-structure__discovery" aria-label="Search and categories">
          <div className="homepage-search-band home-structure__search">
            <SearchBarContainer defaultOpen />
          </div>
          <div className="home-structure__categories">
            <CategoryGridContainer />
          </div>
        </section>

        <section className="home-structure__commerce" aria-label="Trending deals and coupons">
          <HomeDealsCouponsRow />
        </section>

        <section className="home-structure__featured" aria-label="Featured products">
          <TrendingProductsContainer />
        </section>

        <section className="home-structure__recommendations" aria-label="Recommendations">
          <LowestPricesContainer />
          <RecommendedProductsContainer />
          <PersonalizedRecommendationsContainer />
        </section>

        <section className="home-structure__features" aria-label="Platform features">
          <FeaturesSection />
        </section>

        <footer className="home-structure__footer">
          <FooterStatsContainer />
        </footer>
      </div>
    </main>
  );
}
