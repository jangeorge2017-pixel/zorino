import ComparePageClient from "@/components/ComparePageClient";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import { canonicalCompareProducts } from "@/lib/canonical/consumption";
import { compareProductsForQuery } from "@/lib/data/multi-store-comparison";

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

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const rawQuery = params.q;
  const query = (Array.isArray(rawQuery) ? rawQuery[0] : rawQuery)?.trim();
  const matched = query ? await compareProductsForQuery(query, 6) : [];
  const products = matched.length > 0 ? matched : await canonicalCompareProducts(6);
  return <ComparePageClient products={products} />;
}
