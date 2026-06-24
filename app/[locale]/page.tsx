import Navbar from "@/components/navbar";
import Hero from "@/components/Hero";
import SearchBar from "@/components/SearchBar";
import CategoryGrid from "@/components/CategoryGrid";
import ProductCard from "@/components/productcard";
import CouponSection from "@/components/CouponSection";
import FeaturesSection from "@/components/FeaturesSection";
import FooterStats from "@/components/FooterStats";

export default function Home() {
  return (
    <main className="homepage">
      <Navbar />
      <div className="site-shell">
        <div className="hero-zone">
          <Hero />
          <SearchBar defaultOpen />
        </div>
        <CategoryGrid />
        <div className="deals-coupons-row">
          <ProductCard />
          <CouponSection />
        </div>
        <FeaturesSection />
        <FooterStats />
      </div>
    </main>
  );
}
