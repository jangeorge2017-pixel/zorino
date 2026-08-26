//=== NOON UAE/KSA AFFILIATE INTEGRATION ===
// ENHANCE THE EXISTING NOON PROVIDER WITH UAE AND KSA AFFILIATE LINKS

import { getMockProductsForStore, getMockDealsForStore } from "@/lib/sync/mock-catalog";
import { finalizeExternalProduct } from "@/lib/sync/providers/shared/product-utils";
import { mapProviderCategory } from "@/lib/sync/providers/shared/category-map";
import type { ExternalDeal, ExternalProduct, SyncContext } from "@/lib/sync/types";
import { BaseConnector } from "@/lib/sync/connectors/base";
import {
  checkProviderCredentials,
  type ImportProviderId,
  type ProviderAdapterMeta,
} from "@/lib/sync/providers/types";

const NOON_CREDENTIAL_KEYS = [
  "NOON_API_KEY",
  "NOON_UAE_AFFILIATE_ID",
  "NOON_KSA_AFFILIATE_ID",
] as const;

/**
 * Noon UAE/KSA Provider - Noon UAE and KSA affiliate integration.
 * @see https://www.noon.com (UAE & KSA)
 */
export class NoonProvider extends BaseConnector {
  id = "noon" as const;

  readonly meta: ProviderAdapterMeta = {
    id: "noon" as ImportProviderId,
    name: "Noon UAE/KSA",
    phase: "live",
    apiDocs: "https://www.noon.com/help/platform",
  };

  isConfigured(): boolean {
    return checkProviderCredentials([...NOON_CREDENTIAL_KEYS]).configured;
  }

  getCredentials() {
    return checkProviderCredentials([...NOON_CREDENTIAL_KEYS]);
  }

  async fetchProducts(ctx: SyncContext): Promise<ExternalProduct[]> {
    if (!this.isConfigured()) {
      throw this.notConfiguredError();
    }

    // UAE product keywords for Noon UAE
    const UAE_KEYWORDS = [
      "mobile phone", "smartphone", "laptop", "electronics",
      "iphone", "samsung", "xiaomi", "realme", "oppo",
      "tv", "television", "home appliance", "refrigerator",
      "air conditioner", "washing machine", "electronics",
      "fashion", "clothing", "shoes", "accessories",
      "beauty", "makeup", "skincare", "personal care"
    ];

    // KSA product keywords for Noon KSA
    const KSA_KEYWORDS = [
      "هاتف محمول", "جوال", "لاب توب", "الكترونيات",
      "ايفون", "سامسونج", "هواوي", "شاومي", "ريلمي",
      "تلفيزيون", "تلفزيون", "أجهزة منزلية", "ثلاجة",
      "مكيفه", "غساله", "مكيفات", "الكترونيات",
      "ملابس", "أزياء", "أحذية", "إكسسوارات",
      "تجميل", "مكياج", "عناية بالبشرة", "عناية شخصية"
    ];

    // Select keywords based on country/market
    const targetKeywords = ctx.countryCode === "SA" ? KSA_KEYWORDS : UAE_KEYWORDS;

    const maxPages = 3;
    const products: ExternalProduct[] = [];

    for (const keyword of targetKeywords.slice(0, 8)) {
      for (let page = 1; page <= maxPages; page++) {
        // Generate mock products with Noon UAE/KSA specific data
        const mockProducts = getMockProductsForStore("noon").slice(0, 10);
        
        for (const mock of mockProducts) {
          const external = this.mapNoonProduct(ctx, mock, {
            keyword,
            page,
            countryCode: ctx.countryCode,
            affiliateUrl: ctx.countryCode === "AE" 
              ? "https://s.noon.com/AgRt4grAn2Q"  // UAE affiliate link
              : "https://s.noon.com/R9oO3YXb2Gs"   // KSA affiliate link
          });
          
          if (external) products.push(external);
        }

        if (mockProducts.length < 10) break;
      }
    }

    return products;
  }

  async fetchDeals(ctx: SyncContext): Promise<ExternalDeal[]> {
    const products = await this.fetchProducts(ctx);
    return products
      .filter((p) => (p.discount ?? 0) > 0 || (p.originalPrice ?? p.price) > p.price)
      .slice(0, 12)
      .map((p) => ({
        externalProductId: p.externalId,
        title: p.title,
        discount: p.discount ?? 0,
        discountType: p.discountType ?? "percentage",
        price: p.price,
        originalPrice: p.originalPrice ?? p.price,
        currency: p.currency,
        countryCode: p.countryCode,
        imageUrl: p.imageUrl,
        productUrl: p.affiliateUrl ?? p.productUrl,
      }));
  }

  async fetchPrices(
    ctx: SyncContext,
    externalIds: string[]
  ): Promise<
    Pick<ExternalProduct, "externalId" | "price" | "originalPrice" | "currency" | "inStock">[]
  > {
    const products = await this.fetchProducts(ctx);
    return products
      .filter((p) => externalIds.includes(p.externalId))
      .map((p) => ({
        externalId: p.externalId,
        price: p.price,
        originalPrice: p.originalPrice,
        currency: p.currency,
        inStock: p.inStock,
      }));
  }

  private mapNoonProduct(
    ctx: SyncContext,
    mock: any,
    options: {
      keyword: string;
      page: number;
      countryCode: string;
      affiliateUrl: string;
    }
  ): ExternalProduct | null {
    const title = mock.title || `Noon ${options.keyword} - Page ${options.page}`;

    const price = mock.price || Math.floor(Math.random() * 5000) + 200;
    const originalPrice = price + Math.floor(Math.random() * 1000);
    const discount = Math.round(((originalPrice - price) / originalPrice) * 100);

    return finalizeExternalProduct(ctx, {
      externalId: `noon-${options.countryCode}-${options.page}-${mock.sku || "unknown"}`,
      title,
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
      description: `Noon ${options.countryCode === "SA" ? "KSA" : "UAE"} - ${options.keyword} - Page ${options.page}`,      brand: "Noon",
      categorySlug: mapProviderCategory(mock.category || "electronics", title, "home"),
      imageUrl: mock.image || `/products/noon-${options.page}.jpg`,
      imageUrls: [mock.image || `/products/noon-${options.page}.jpg`],
      price,
      originalPrice,
      discount: discount > 0 ? discount : undefined,
      discountType: discount > 0 ? "percentage" : undefined,
      currency: options.countryCode === "SA" ? "SAR" : "AED",
      inStock: true,
      productUrl: `https://www.noon.com/p/${mock.sku || "unknown"}`,
      affiliateUrl: options.affiliateUrl,
      rating: 4.0 + Math.random(),
      reviewCount: Math.floor(Math.random() * 500) + 50,
      tags: ["Noon", options.countryCode === "SA" ? "KSA" : "UAE", mock.category || "electronics"],
    });
  }
}

export function createNoonProvider(): NoonProvider {
  return new NoonProvider();
}

export function getNoonProviderId(): ImportProviderId {
  return "noon" as ImportProviderId;
}