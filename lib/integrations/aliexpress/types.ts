export type AliExpressCredentials = {
  appKey: string;
  appSecret: string;
  trackingId?: string;
};

export type AliExpressCredentialStatus = {
  configured: boolean;
  hasAppKey: boolean;
  hasAppSecret: boolean;
  hasTrackingId: boolean;
  source: "env" | "database" | "none";
};

export type AliExpressValidationResult = {
  ok: boolean;
  message: string;
  testedAt: string;
};

export type AliExpressRawProduct = {
  product_id?: string | number;
  product_title?: string;
  product_main_image_url?: string;
  product_small_image_urls?: string[] | { string?: string[] };
  target_sale_price?: string;
  target_original_price?: string;
  target_sale_price_currency?: string;
  promotion_link?: string;
  product_detail_url?: string;
  shop_id?: string;
  shop_title?: string;
  shop_url?: string;
  evaluate_rate?: string;
  lastest_volume?: string | number;
  first_level_category_name?: string;
  sku_available_stock?: string;
};

export type AliExpressSyncJobKind = "products" | "prices" | "stock" | "images" | "full";

export type ImportEventLevel = "info" | "warn" | "error";

export type ImportEventLog = {
  id: string;
  provider: string;
  jobType: string;
  level: ImportEventLevel;
  message: string;
  metadata: Record<string, unknown>;
  syncRunId: string | null;
  createdAt: string;
};
