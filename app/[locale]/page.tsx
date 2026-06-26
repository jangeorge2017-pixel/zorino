import Navbar from "@/components/navbar";
import HeroContainer from "@/components/HeroContainer";
import HomeQuickNav from "@/components/HomeQuickNav";
import SearchBarContainer from "@/components/SearchBarContainer";
import CategoryGridContainer from "@/components/CategoryGridContainer";
import LowestPricesContainer from "@/components/LowestPricesContainer";
import TrendingProductsContainer from "@/components/TrendingProductsContainer";
import RecommendedProductsContainer from "@/components/RecommendedProductsContainer";
import PersonalizedRecommendationsContainer from "@/components/PersonalizedRecommendationsContainer";
import HomeDealsCouponsRow from "@/components/HomeDealsCouponsRow";
import FeaturesSection from "@/components/FeaturesSection";
import FooterStatsContainer from "@/components/FooterStatsContainer";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return buildSeoMetadata({
    title: "Find the Best Deals Across All Marketplaces",
    locale,
    alternateLocales: locale === "en" ? ["ar"] : ["en"],
  });
}

export default function Home() {
  return (
    <main className="homepage">
      <Navbar />
      <div className="site-shell">
        <div className="hero-zone">
          <HeroContainer />
          <HomeQuickNav />
          <SearchBarContainer defaultOpen />
        </div>
        <CategoryGridContainer />
        <LowestPricesContainer />
        <TrendingProductsContainer />
        <RecommendedProductsContainer />
        <PersonalizedRecommendationsContainer />
        <HomeDealsCouponsRow />
        <FeaturesSection />
        <FooterStatsContainer />
      </div>
    </main>
  );
}
