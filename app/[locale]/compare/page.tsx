import ComparePageClient from "@/components/ComparePageClient";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import {
  browseAliExpressLive,
  searchItemToCompareResult,
} from "@/services/aliexpress/search";

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

export default async function ComparePage() {
  const items = await browseAliExpressLive(6);
  const products = items.map(searchItemToCompareResult);
  return <ComparePageClient products={products} />;
}
