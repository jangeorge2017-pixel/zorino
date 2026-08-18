import ProductsPageClient from "@/components/ProductsPageClient";
import { generateMetadata as buildSeoMetadata } from "@/lib/seo/metadata";
import { searchProducts } from "@/lib/search/engine";
import { filtersFromSearchResults } from "@/services/aliexpress/search";

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

const PRODUCTS_QUERIES = [
  "iphone", "samsung", "laptop", "monitor",
  "earbuds", "keyboard", "smartwatch", "camera",
] as const;

export default async function ProductsPage() {
  const batches = await Promise.all(
    PRODUCTS_QUERIES.map((q) => searchProducts(q, 8).catch(() => [])),
  );
  const seen = new Set<string>();
  const products = batches.flat().filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  const filters =
    products.length > 0
      ? filtersFromSearchResults(products)
      : { categories: [], stores: [] };

  return (
    <ProductsPageClient
      products={products}
      categories={filters.categories}
      stores={filters.stores}
    />
  );
}
