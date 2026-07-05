/** Per-job import configuration stored on sync_jobs.config */
export type ImportJobConfig = {
  keywords?: string[];
  categorySlug?: string;
  maxPages?: number;
  pageSize?: number;
  productIds?: string[];
};

export const DEFAULT_IMPORT_KEYWORDS: Record<string, string[]> = {
  aliexpress: ["wireless earbuds", "smart watch", "phone case", "bluetooth speaker"],
  ebay: ["iphone", "macbook", "playstation", "nike shoes"],
  amazon: ["electronics", "laptop", "smartphone", "headphones"],
  walmart: ["electronics", "tv", "laptop", "gaming"],
  temu: ["home gadgets", "phone accessories", "fashion deals"],
  cjdropshipping: ["phone accessories", "home decor", "pet supplies"],
};

export function resolveImportConfig(
  provider: string,
  jobConfig?: Record<string, unknown> | null
): ImportJobConfig {
  const keywords =
    Array.isArray(jobConfig?.keywords) && jobConfig.keywords.length > 0
      ? (jobConfig.keywords as string[])
      : DEFAULT_IMPORT_KEYWORDS[provider] ?? ["electronics"];

  return {
    keywords,
    categorySlug: typeof jobConfig?.categorySlug === "string" ? jobConfig.categorySlug : undefined,
    maxPages: typeof jobConfig?.maxPages === "number" ? jobConfig.maxPages : 2,
    pageSize: typeof jobConfig?.pageSize === "number" ? jobConfig.pageSize : 20,
    productIds: Array.isArray(jobConfig?.productIds)
      ? (jobConfig.productIds as string[])
      : undefined,
  };
}
