import ProductsPageClient from "@/components/ProductsPageClient";
import {
  getMockProductsForPage,
  getMockSearchFilters,
} from "@/lib/mock/page-data";

export default function ProductsPage() {
  const products = getMockProductsForPage();
  const filters = getMockSearchFilters();

  return (
    <ProductsPageClient
      products={products}
      categories={filters.categories}
      stores={filters.stores}
    />
  );
}
