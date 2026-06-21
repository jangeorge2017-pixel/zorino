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
    <main className="hero">
      <Navbar />
      <Hero />
      <SearchBar />
      <div className="page-content">
        <CategoryGrid />
        <ProductCard />
        <CouponSection />
        <FeaturesSection />
        <FooterStats />
      </div>
    </main>
  );
}
