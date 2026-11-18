import { fetchJsonSafely } from "@/lib/integrations/egypt-stores/http";
import {
  cleanTitle,
  discountPercent,
  parseMoney,
  resolveUrl,
} from "@/lib/integrations/egypt-stores/parse";
import type { StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";
import type { RawProviderListing } from "@/lib/search/types";

const BASE_URL = (process.env.ELDOKAN_BASE_URL?.trim() || "https://eldokan.com").replace(/\/+$/, "");
const STORE_NAME = "El Dokan";

type ShopifyProduct = {
  handle?: string;
  title?: string;
  url?: string;
  image?: string;
  featured_image?: string;
  price?: string | number;
  compare_at_price?: string | number;
  available?: boolean;
};

type ShopifySuggestResponse = {
  resources?: {
    results?: {
      products?: ShopifyProduct[];
    };
  };
};

export function parseEldokanProducts(products: ShopifyProduct[]): RawProviderListing[] {
  const results: RawProviderListing[] = [];
  const seen = new Set<string>();

  for (const product of products) {
    const productUrl = resolveUrl(product.url, BASE_URL);
    const imageUrl = resolveUrl(product.image ?? product.featured_image, BASE_URL);
    const title = cleanTitle(product.title);
    const price = parseMoney(product.price);
    if (!productUrl || !imageUrl || !title || !price) continue;

    const externalId =
      (() => {
        try {
          return new URL(productUrl).pathname.split("/").filter(Boolean).pop() ?? "";
        } catch {
          return "";
        }
      })() ||
      product.handle?.trim() ||
      title;
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const originalPrice = parseMoney(product.compare_at_price);
    const effectiveOriginal = originalPrice > price ? originalPrice : price;

    results.push({
      providerId: "eldokan",
      externalId,
      title,
      imageUrl,
      price,
      originalPrice: effectiveOriginal,
      discount: discountPercent(price, effectiveOriginal),
      currency: "EGP",
      storeName: STORE_NAME,
      category: "",
      rating: 0,
      reviewCount: 0,
      inStock: product.available !== false,
      productUrl,
      countryCode: "EG",
    });
  }

  return results;
}

export const eldokanAdapter: StoreSearchAdapter = {
  id: "eldokan",
  name: STORE_NAME,
  async search(query) {
    const params = new URLSearchParams({
      q: query,
      "resources[type]": "product",
      "resources[limit]": "20",
    });
    const data = await fetchJsonSafely<ShopifySuggestResponse>(
      `${BASE_URL}/search/suggest.json?${params.toString()}`,
      { timeoutMs: 4_000 },
    );
    const products = data?.resources?.results?.products;
    return Array.isArray(products) ? parseEldokanProducts(products) : [];
  },
};
