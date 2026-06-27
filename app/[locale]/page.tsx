import Navbar from "@/components/navbar";
import HeroContainer from "@/components/HeroContainer";
import SearchBarContainer from "@/components/SearchBarContainer";
import CategoryGridContainer from "@/components/CategoryGridContainer";
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
    <main className="homepage homepage--reference">
      <Navbar />
      <div className="site-shell">
        <div className="hero-zone">
          <HeroContainer />
        </div>

        <div className="homepage-search-band">
          <SearchBarContainer defaultOpen />
        </div>

        <CategoryGridContainer />

        <HomeDealsCouponsRow />

        <FeaturesSection />
        <FooterStatsContainer />
      </div>
    </main>
  );
}
