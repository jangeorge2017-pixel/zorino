import ProductsPageClient from "@/components/ProductsPageClient";
import {
  ALIEXPRESS_SEARCH_FILTERS,
  browseAliExpressLive,
  filtersFromSearchResults,
} from "@/services/aliexpress/search";

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
