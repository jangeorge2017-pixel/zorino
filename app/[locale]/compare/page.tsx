import ComparePageClient from "@/components/ComparePageClient";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import { searchProducts } from "@/lib/search/engine";
import { searchItemToCompareResult } from "@/services/aliexpress/search";
import { enrichCompareResults } from "@/lib/data/multi-store-comparison";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return buildSeoMetadata({
    title: "Compare Products",
    description: "Compare products side by side",
    pathname: "/compare",
    locale: locale === "ar" ? "ar" : "en",
  });
}

const COMPARE_QUERIES = ["laptop", "monitor", "earbuds", "smartwatch"] as const;

export default async function ComparePage() {
  const batches = await Promise.all(
    COMPARE_QUERIES.map((q) => searchProducts(q, 4).catch(() => [])),
  );
  const seen = new Set<string>();
  const items = batches.flat().filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const baseProducts = items.slice(0, 6).map(searchItemToCompareResult);
  const products = await enrichCompareResults(baseProducts);
  return <ComparePageClient products={products} />;
}
