import type { MarketplaceProviderId } from "@/lib/marketplace-engine/types";

/** Active Phase 4 marketplace providers with live import pipelines. */
export const ACTIVE_MARKETPLACE_PROVIDERS: MarketplaceProviderId[] = [
  "aliexpress",
  "ebay",
  "cjdropshipping",
];

/** Future providers — registry ready, adapters plug in via lib/sync/providers. */
export const FUTURE_MARKETPLACE_PROVIDERS: MarketplaceProviderId[] = [
  "amazon",
  "temu",
  "walmart",
];

export const ALL_MARKETPLACE_PROVIDERS: MarketplaceProviderId[] = [
  ...ACTIVE_MARKETPLACE_PROVIDERS,
  ...FUTURE_MARKETPLACE_PROVIDERS,
];

export const DUPLICATE_MATCH_CONFIDENCE = {
  external_id: 1,
  identifier: 0.98,
  slug: 0.92,
  title: 0.88,
  fuzzy_title: 0.75,
} as const;

export const FUZZY_TITLE_THRESHOLD = 0.82;

export const IDENTIFIER_SPEC_KEYS: Record<string, string[]> = {
  gtin: ["gtin", "GTIN", "global_trade_item_number"],
  upc: ["upc", "UPC"],
  ean: ["ean", "EAN"],
  mpn: ["mpn", "MPN", "manufacturer_part_number", "part_number"],
  asin: ["asin", "ASIN"],
  sku: ["sku", "SKU", "item_sku"],
  model: ["model", "model_number", "Model"],
};
