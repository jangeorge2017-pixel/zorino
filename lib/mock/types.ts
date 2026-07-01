import type { Category, Coupon, Deal, Product, Store } from "@/lib/types/entities";
import type { CompareProductResult } from "@/services/compare";
import type { ProductDetail } from "@/lib/data/product-detail";
import type { SearchResultItem } from "@/lib/data/homepage";

export type MockBlogPost = {
  id: string;
  slug: string;
  title: string;
  titleAr: string;
  excerpt: string;
  excerptAr: string;
  image: string;
  author: string;
  category: string;
  categorySlug: string;
  tags: string[];
  publishedAt: string;
  readingTime: string;
  views: number;
  featured: boolean;
  content: string[];
};

export type MockWishlistItem = {
  id: string;
  name: string;
  imageSrc: string;
  emoji: string;
  price: number;
  originalPrice: number;
  discount: number;
  store: string;
  storeSlug: string;
  rating: number;
  inStock: boolean;
  priceAlert: number;
  priceDrop: boolean;
  addedAt: string;
};

export type MockStoreDetail = {
  store: Store;
  description: string;
  productCount: number;
  avgRating: number;
  dealsCount: number;
  couponsCount: number;
  products: SearchResultItem[];
};

export type MockCategoryDetail = {
  category: Category;
  description: string;
  products: SearchResultItem[];
};

export type { CompareProductResult, ProductDetail, SearchResultItem, Deal, Coupon, Store, Category, Product };
