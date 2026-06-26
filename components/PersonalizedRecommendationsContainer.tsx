import RecommendedProductsSection from "@/components/RecommendedProductsSection";
import { getHomepagePersonalizedProducts } from "@/lib/data/recommendations";
import { getCurrentUser } from "@/services/users";

export default async function PersonalizedRecommendationsContainer() {
  const { data: user } = await getCurrentUser();
  const products = await getHomepagePersonalizedProducts(user?.id ?? null, 8);

  return (
    <RecommendedProductsSection
      variant="recommended-for-you"
      title="Recommended for You"
      subtitle={
        user
          ? "Based on your interests and browsing history"
          : "Popular picks — sign in for personalized recommendations"
      }
      products={products}
      isLoggedIn={Boolean(user)}
    />
  );
}
