/** Phase 1 import providers — only products synced from these count as live catalog items. */
export const PHASE1_IMPORT_PROVIDERS = ["aliexpress", "ebay", "cjdropshipping"] as const;

/** SQL-safe filter: synced imported products with real (non-local) images. */
export const IMPORTED_PRODUCT_SYNC_STATUS = "synced" as const;

/** Returns true when a product row represents a real API import (not seed/demo). */
export function isImportedProductRow(product: {
  sync_status?: string | null;
  last_synced_at?: string | null;
  image_url?: string | null;
  is_active?: boolean | null;
}): boolean {
  if (product.is_active === false) return false;
  if (product.sync_status !== IMPORTED_PRODUCT_SYNC_STATUS) return false;
  if (!product.last_synced_at) return false;
  if (product.image_url?.startsWith("/products/")) return false;
  return true;
}
