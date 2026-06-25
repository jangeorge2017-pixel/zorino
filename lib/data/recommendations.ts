import { getRecommendedProducts, getPersonalizedRecommendations } from "@/services/recommendations";

export async function getHomepageRecommendedProducts(limit = 8) {
  const { data, error } = await getRecommendedProducts(limit);
  if (error) return [];
  return data;
}

export async function getHomepagePersonalizedProducts(userId?: string | null, limit = 8) {
  const { data, error } = await getPersonalizedRecommendations(userId, limit);
  if (error) return [];
  return data;
}
