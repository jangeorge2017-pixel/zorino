import TrendingProductsSection from "@/components/TrendingProductsSection";
import { getHomepageTrendingSection } from "@/lib/data/trending";

export default async function TrendingProductsContainer() {
  const data = await getHomepageTrendingSection("US");
  return <TrendingProductsSection data={data} countryCode="US" />;
}
