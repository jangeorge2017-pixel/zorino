/**
 * Unit tests — Admitad network offers → global multi-store schema.
 *
 * The Admitad network must preserve each real merchant name and market country
 * while writing collision-safe global products.
 */
import { describe, expect, it } from "vitest";

import type { NormalizedCatalogItem } from "@/lib/integration/catalog-types";
import {
  ADMITAD_NETWORK_NAME,
  syncAdmitadItemsToGlobalSchema,
} from "@/lib/integrations/admitad/global-catalog";
import type { SupabaseDb } from "@/lib/supabase/config";

type Row = Record<string, unknown>;

function fakeSupabase(state: { products: Row[]; offers: { row: Row; options?: Row }[] }) {
  const client = {
    from(table: string) {
      if (table === "products") {
        return {
          upsert(row: Row) {
            state.products.push(row);
            const id = `pid-${String(row.global_sku)}`;
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: { id }, error: null });
                  },
                };
              },
            };
          },
        };
      }
      if (table === "product_offers") {
        return {
          upsert(row: Row, options?: Row) {
            state.offers.push({ row, options });
            return Promise.resolve({ error: null });
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
  return client as unknown as SupabaseDb;
}

function item(overrides: Partial<NormalizedCatalogItem> = {}): NormalizedCatalogItem {
  return {
    id: "admitad-555-offer-1",
    slug: "admitad-555-offer-1",
    title: "Real Merchant Product",
    imageUrl: "https://cdn.example.com/p.jpg",
    emoji: "cart",
    categorySlug: "general",
    rating: 0,
    reviewCount: 0,
    countryCode: "EG",
    currency: "EGP",
    price: 199,
    originalPrice: 249,
    discount: 20,
    discountType: "percentage",
    providerIds: ["admitad"],
    fetchedAt: new Date().toISOString(),
    offers: [
      {
        providerId: "admitad",
        storeSlug: "real-merchant",
        storeName: "Real Merchant",
        externalId: "offer-1",
        price: 199,
        originalPrice: 249,
        currency: "EGP",
        countryCode: "EG",
        productUrl: "https://merchant.example.com/p/1",
        affiliateUrl: "https://ad.admitad.com/g/1",
        inStock: true,
      },
    ],
    ...overrides,
  };
}

describe("syncAdmitadItemsToGlobalSchema", () => {
  it("maps a real merchant offer into products + product_offers", async () => {
    const state = { products: [] as Row[], offers: [] as { row: Row; options?: Row }[] };
    const result = await syncAdmitadItemsToGlobalSchema(fakeSupabase(state), [item()]);

    expect(result).toMatchObject({ offersUpserted: 1, failed: 0, skipped: 0 });
    expect(state.products).toHaveLength(1);
    expect(state.products[0]).toMatchObject({
      global_sku: "admitad:555:offer-1",
      title: "Real Merchant Product",
      main_image: "https://cdn.example.com/p.jpg",
      category_path: "general",
    });
    expect(state.offers).toHaveLength(1);
    expect(state.offers[0].row).toMatchObject({
      product_id: "pid-admitad:555:offer-1",
      store_name: "Real Merchant",
      network_name: ADMITAD_NETWORK_NAME,
      country_code: "EG",
      price: 199,
      currency: "EGP",
      affiliate_url: "https://ad.admitad.com/g/1",
      product_store_url: "https://merchant.example.com/p/1",
      in_stock: true,
    });
    expect(state.offers[0].options?.onConflict).toBe(
      "product_id,store_name,country_code",
    );
  });

  it("skips a row with no real merchant name instead of inventing one", async () => {
    const state = { products: [] as Row[], offers: [] as { row: Row; options?: Row }[] };
    const broken = item();
    broken.offers[0] = { ...broken.offers[0], storeName: "  " };
    const result = await syncAdmitadItemsToGlobalSchema(fakeSupabase(state), [broken]);

    expect(result).toMatchObject({ offersUpserted: 0, skipped: 1 });
    expect(state.products).toHaveLength(0);
    expect(state.offers).toHaveLength(0);
  });

  it("stops at maxItems and reports it", async () => {
    const state = { products: [] as Row[], offers: [] as { row: Row; options?: Row }[] };
    const second = item({ id: "admitad-555-offer-2", slug: "second" });
    const result = await syncAdmitadItemsToGlobalSchema(fakeSupabase(state), [item(), second], {
      maxItems: 1,
    });

    expect(result.offersUpserted).toBe(1);
    expect(result.stoppedReason).toBe("max-items");
    expect(state.products).toHaveLength(1);
  });
});
