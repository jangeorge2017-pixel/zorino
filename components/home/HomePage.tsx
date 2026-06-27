import Navbar from "@/components/navbar";
import HeroContainer from "@/components/HeroContainer";
import SearchBarContainer from "@/components/SearchBarContainer";
import CategoryGridContainer from "@/components/CategoryGridContainer";
import HomeDealsCouponsRow from "@/components/HomeDealsCouponsRow";
import FeaturesSection from "@/components/FeaturesSection";
import FooterStatsContainer from "@/components/FooterStatsContainer";

/**
 * Blueprint: public/reference/zorino-final-design.png
 * Section order: Navbar → Hero → Search → Categories → Deals|Coupons → Features → Footer
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
