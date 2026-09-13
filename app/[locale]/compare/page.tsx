import ComparePageClient from "@/components/ComparePageClient";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import { canonicalCompareProducts } from "@/lib/canonical/consumption";

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
  const products = await canonicalCompareProducts(6);
  return <ComparePageClient products={products} />;
}
