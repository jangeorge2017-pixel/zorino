import Navbar from "@/components/navbar";
import HeroContainer from "@/components/HeroContainer";
import SearchBarContainer from "@/components/SearchBarContainer";
import CategoryGridContainer from "@/components/CategoryGridContainer";
import LowestPricesContainer from "@/components/LowestPricesContainer";
import TrendingProductsContainer from "@/components/TrendingProductsContainer";
import HomeDealsCouponsRow from "@/components/HomeDealsCouponsRow";
import FeaturesSection from "@/components/FeaturesSection";
import FooterStatsContainer from "@/components/FooterStatsContainer";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <main className="homepage">
      <Navbar />
      <div className="site-shell">
        <div className="hero-zone">
          <HeroContainer />
          <SearchBarContainer defaultOpen />
        </div>
        <CategoryGridContainer />
        <LowestPricesContainer />
        <TrendingProductsContainer />
        <HomeDealsCouponsRow />
        <FeaturesSection />
        <FooterStatsContainer />
      </div>
    </main>
  );
}
