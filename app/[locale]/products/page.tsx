import ProductsPageClient from "@/components/ProductsPageClient";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import {
  ALIEXPRESS_SEARCH_FILTERS,
  browseAliExpressLive,
  filtersFromSearchResults,
} from "@/services/aliexpress/search";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return buildSeoMetadata({
    title: "All Products",
    description: "Browse thousands of products across every category and store",
    pathname: "/products",
    locale: locale === "ar" ? "ar" : "en",
  });
}

export default async function ProductsPage() {
  const products = await browseAliExpressLive(24);
  const filters =
    products.length > 0 ? filtersFromSearchResults(products) : ALIEXPRESS_SEARCH_FILTERS;

  return (
    <ProductsPageClient
      products={products}
      categories={filters.categories}
      stores={filters.stores}
    />
  );
}
