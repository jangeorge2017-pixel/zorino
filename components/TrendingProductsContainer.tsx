import TrendingProductsSection from "@/components/TrendingProductsSection";
import { getHomepageTrendingSection } from "@/lib/data/trending";

export default async function TrendingProductsContainer() {
  const data = await getHomepageTrendingSection("US");
  const hasProducts = Object.values(data).some((items) => items.length > 0);
  if (!hasProducts) return null;

  return <TrendingProductsSection data={data} countryCode="US" />;
}
