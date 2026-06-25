import { getCategoryBySlug } from "@/services/categories";
import { getCurrentPricesForProduct } from "@/services/prices";
import { getProductById } from "@/services/products";
import type { Product } from "@/lib/types/entities";

export type ProductStoreOffer = {
  id: string;
  name: string;
  logoUrl?: string | null;
  logoInitial: string;
  price: number;
  originalPrice: number;
  inStock: boolean;
  externalUrl?: string | null;
};

export type ProductDetail = {
  product: Product;
  categoryName: string;
  price: number;
  originalPrice: number;
  discount: number;
  stores: ProductStoreOffer[];
};

export async function getProductDetail(id: string): Promise<ProductDetail | null> {
  const { data: product, error } = await getProductById(id);
  if (error || !product) return null;

  const [pricesResult, categoryResult] = await Promise.all([
    getCurrentPricesForProduct(product.id),
    product.categorySlug
      ? getCategoryBySlug(product.categorySlug)
      : Promise.resolve({ data: null, error: null }),
  ]);

  const stores: ProductStoreOffer[] = pricesResult.data.map((price) => ({
    id: price.storeId,
    name: price.store?.name ?? "Store",
    logoUrl: price.store?.logoUrl,
    logoInitial: price.store?.logoInitial ?? price.store?.name.slice(0, 2) ?? "?",
    price: price.price,
    originalPrice: price.originalPrice ?? price.price,
    inStock: price.inStock,
    externalUrl: price.externalUrl,
  }));

  const lowest = pricesResult.data[0];
  const price = lowest?.price ?? 0;
  const original = lowest?.originalPrice ?? price;
  const discount =
    original > 0 ? Math.max(0, Math.round(((original - price) / original) * 100)) : 0;

  return {
    product,
    categoryName: categoryResult.data?.name ?? product.categorySlug ?? "General",
    price,
    originalPrice: original || price,
    discount,
    stores,
  };
}
