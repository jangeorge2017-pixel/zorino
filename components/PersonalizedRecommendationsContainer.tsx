import RecommendedProductsSection from "@/components/RecommendedProductsSection";
import { getHomepagePersonalizedProducts } from "@/lib/data/recommendations";
import { getCurrentUser } from "@/services/users";

export default async function PersonalizedRecommendationsContainer() {
  const { data: user } = await getCurrentUser();
  const products = await getHomepagePersonalizedProducts(user?.id ?? null, 8);

  return (
    <RecommendedProductsSection
      title="Recommended for You"
      subtitle={
        user
          ? "Based on your favorites, clicks, and trending deals"
          : "Popular picks — sign in for personalized recommendations"
      }
      icon="personalized"
      products={products}
    />
  );
}
