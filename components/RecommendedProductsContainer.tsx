import RecommendedProductsSection from "@/components/RecommendedProductsSection";
import { getHomepageRecommendedProducts } from "@/lib/data/recommendations";

export default async function RecommendedProductsContainer() {
  const products = await getHomepageRecommendedProducts(8);
  return (
    <RecommendedProductsSection
      variant="recommended-products"
      title="Recommended Products"
      subtitle="Top-rated deals from AliExpress, eBay, and CJdropshipping"
      products={products}
    />
  );
}
