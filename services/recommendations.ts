import { mapProduct } from "@/lib/database/mappers";
import type { ProductRow } from "@/lib/database/types";
import { IMPORTED_PRODUCT_SYNC_STATUS } from "@/lib/catalog/imported-products";
import { getTrendingProducts } from "@/services/trending/queries";
import { getCurrentPricesForProduct } from "@/services/prices";
import { createSupabaseAnonClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import type { Product, ServiceResult } from "@/lib/types/entities";

export type RecommendedProductCard = {
  id: string;
  slug: string;
  name: string;
  imageUrl: string;
  emoji: string;
  price: number;
  originalPrice: number;
  discount: number;
  rating: number;
  reviewCount: number;
  storeName: string;
  reason: string;
};

function importedProductQuery(supabase: NonNullable<ReturnType<typeof createSupabaseAnonClient>>) {
  return supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("sync_status", IMPORTED_PRODUCT_SYNC_STATUS)
    .not("last_synced_at", "is", null)
    .not("image_url", "like", "/products/%");
}

async function toRecommendedCard(
  product: Product,
  reason: string
): Promise<RecommendedProductCard> {
  const prices = await getCurrentPricesForProduct(product.id);
  const lowest = prices.data[0];
  const price = lowest?.price ?? 0;
  const original = lowest?.originalPrice ?? price;
  const discount =
    original > 0 ? Math.max(0, Math.round(((original - price) / original) * 100)) : 0;

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    imageUrl: product.imageUrl,
    emoji: product.emoji ?? "🛍️",
    price,
    originalPrice: original || price,
    discount,
    rating: product.rating ?? 4.5,
    reviewCount: product.reviewCount,
    storeName: lowest?.store?.name ?? "Zorino",
    reason,
  };
}

/** Editor's picks — highest-rated imported products with active prices. */
export async function getRecommendedProducts(
  limit = 8
): Promise<ServiceResult<RecommendedProductCard[]>> {
  const supabase = createSupabaseAnonClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const { data, error } = await importedProductQuery(supabase)
    .order("rating", { ascending: false, nullsFirst: false })
    .order("review_count", { ascending: false })
    .limit(limit);

  if (error) return { data: [], error: error.message };

  const cards: RecommendedProductCard[] = [];
  for (const row of (data ?? []) as ProductRow[]) {
    cards.push(await toRecommendedCard(mapProduct(row), "Top rated"));
  }
  return { data: cards, error: null };
}

/** Personalized picks from favorites, click history, or trending fallback. */
export async function getPersonalizedRecommendations(
  userId?: string | null,
  limit = 8
): Promise<ServiceResult<RecommendedProductCard[]>> {
  const supabase = createSupabaseServiceClient() ?? createSupabaseAnonClient();
  if (!supabase) return { data: [], error: "Supabase not configured" };

  const productIds = new Set<string>();

  if (userId) {
    const { data: favorites } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", userId)
      .limit(10);
    for (const f of (favorites ?? []) as { product_id: string }[]) productIds.add(f.product_id);

    const { data: clicks } = await supabase
      .from("affiliate_clicks")
      .select("product_id")
      .eq("user_id", userId)
      .not("product_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);
    for (const c of (clicks ?? []) as { product_id: string | null }[]) {
      if (c.product_id) productIds.add(c.product_id);
    }
  }

  if (productIds.size > 0) {
    const { data } = await importedProductQuery(supabase)
      .in("id", [...productIds])
      .limit(limit);

    const cards: RecommendedProductCard[] = [];
    for (const row of (data ?? []) as ProductRow[]) {
      cards.push(await toRecommendedCard(mapProduct(row), "Based on your activity"));
    }
    if (cards.length >= limit) return { data: cards.slice(0, limit), error: null };
  }

  const trending = await getTrendingProducts("hot_deals", { limit });
  if (trending.data.length > 0) {
    return {
      data: trending.data
        .filter((t) => Boolean(t.productId))
        .slice(0, limit)
        .map((t) => ({
          id: t.productId!,
        slug: t.slug,
        name: t.name,
        imageUrl: t.imageSrc,
        emoji: t.emoji,
        price: t.price,
        originalPrice: t.originalPrice,
        discount: t.discount,
        rating: t.rating,
        reviewCount: t.reviews,
        storeName: t.store,
        reason: "Trending for you",
      })),
      error: null,
    };
  }

  return getRecommendedProducts(limit);
}
