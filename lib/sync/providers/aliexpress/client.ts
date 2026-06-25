import { createHash } from "node:crypto";
import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { fetchJson } from "@/lib/sync/providers/shared/http";

const API_URL = "https://api-sg.aliexpress.com/sync";

type AliExpressProduct = {
  product_id?: string;
  product_title?: string;
  product_main_image_url?: string;
  product_small_image_urls?: string[];
  target_sale_price?: string;
  target_original_price?: string;
  target_sale_price_currency?: string;
  promotion_link?: string;
  product_detail_url?: string;
  shop_url?: string;
  evaluate_rate?: string;
  lastest_volume?: string;
  first_level_category_name?: string;
};

function signParams(params: Record<string, string>, secret: string): string {
  const sorted = Object.keys(params).sort();
  let base = secret;
  for (const key of sorted) base += key + params[key];
  base += secret;
  return createHash("md5").update(base).digest("hex").toUpperCase();
}

export class AliExpressClient {
  constructor(
    private appKey: string,
    private appSecret: string,
    private trackingId?: string
  ) {}

  async searchProducts(
    config: ImportJobConfig,
    currency: string
  ): Promise<AliExpressProduct[]> {
    const all: AliExpressProduct[] = [];
    const keywords = config.keywords ?? ["electronics"];
    const maxPages = config.maxPages ?? 2;
    const pageSize = config.pageSize ?? 20;

    for (const keyword of keywords) {
      for (let page = 1; page <= maxPages; page++) {
        const batch = await this.call<{
          aliexpress_affiliate_product_query_response?: {
            resp_result?: { result?: { products?: AliExpressProduct[] } };
            resp_code?: number;
            resp_msg?: string;
          };
        }>("aliexpress.affiliate.product.query", {
          keywords: keyword,
          page_no: String(page),
          page_size: String(pageSize),
          target_currency: currency,
          target_language: "EN",
          ...(this.trackingId ? { tracking_id: this.trackingId } : {}),
        });

        const products =
          batch.aliexpress_affiliate_product_query_response?.resp_result?.result
            ?.products ?? [];

        all.push(...products);
        if (products.length < pageSize) break;
      }
    }

    return dedupeById(all);
  }

  async getProductsByIds(ids: string[], currency: string): Promise<AliExpressProduct[]> {
    if (ids.length === 0) return [];

    const batch = await this.call<{
      aliexpress_affiliate_productdetail_get_response?: {
        resp_result?: { result?: { products?: AliExpressProduct[] } };
      };
    }>("aliexpress.affiliate.productdetail.get", {
      product_ids: ids.slice(0, 50).join(","),
      target_currency: currency,
      target_language: "EN",
      ...(this.trackingId ? { tracking_id: this.trackingId } : {}),
    });

    return (
      batch.aliexpress_affiliate_productdetail_get_response?.resp_result?.result
        ?.products ?? []
    );
  }

  private async call<T>(method: string, bizParams: Record<string, string>): Promise<T> {
    const timestamp = Date.now().toString();
    const params: Record<string, string> = {
      method,
      app_key: this.appKey,
      sign_method: "md5",
      timestamp,
      format: "json",
      v: "2.0",
      ...bizParams,
    };
    params.sign = signParams(params, this.appSecret);

    const body = new URLSearchParams(params);
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: body.toString(),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`AliExpress API ${res.status}: ${text.slice(0, 300)}`);

    const json = JSON.parse(text) as T & {
      error_response?: { msg?: string; sub_msg?: string };
    };
    if (json.error_response) {
      throw new Error(
        json.error_response.msg ?? json.error_response.sub_msg ?? "AliExpress API error"
      );
    }
    return json;
  }
}

function dedupeById(products: AliExpressProduct[]): AliExpressProduct[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const id = p.product_id ?? p.product_title ?? "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
