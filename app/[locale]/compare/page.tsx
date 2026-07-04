import ComparePageClient from "@/components/ComparePageClient";
import {
  browseAliExpressLive,
  searchItemToCompareResult,
} from "@/services/aliexpress/search";

export default async function ComparePage() {
  const items = await browseAliExpressLive(6);
  const products = items.map(searchItemToCompareResult);
  return <ComparePageClient products={products} />;
}
