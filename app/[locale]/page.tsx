import Navbar from "@/components/navbar";
import HeroContainer from "@/components/HeroContainer";
import SearchBarContainer from "@/components/SearchBarContainer";
import CategoryGridContainer from "@/components/CategoryGridContainer";
import LowestPricesContainer from "@/components/LowestPricesContainer";
import TrendingProductsContainer from "@/components/TrendingProductsContainer";
import ProductCard from "@/components/productcard";
import CouponSectionContainer from "@/components/CouponSectionContainer";
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
        <div className="deals-coupons-row">
          <ProductCard />
          <CouponSectionContainer />
        </div>
        <FeaturesSection />
        <FooterStatsContainer />
      </div>
    </main>
  );
}
