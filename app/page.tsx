import Navbar from "../components/navbar";
import Hero from "../components/Hero";
import CategoryGrid from "../components/CategoryGrid";
import ProductCard from "../components/productcard";
import CouponSection from "../components/CouponSection";

export default function Home() {
  return (
    <main className="hero">
      <Navbar />

      <Hero />

      <CategoryGrid />

      <ProductCard />

      <CouponSection />
    </main>
  );
}