import LowestPricesSection from "@/components/LowestPricesSection";
import { getHomepageLowestPrices, getLowestPricesLastComputed } from "@/lib/data/lowest-prices";

export default async function LowestPricesContainer() {
  const [items, lastComputedAt] = await Promise.all([
    getHomepageLowestPrices(),
    getLowestPricesLastComputed(),
  ]);

  if (items.length === 0) return null;

  return <LowestPricesSection items={items} lastComputedAt={lastComputedAt} />;
}
