import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { ALIEXPRESS_API_URL } from "@/lib/integrations/aliexpress/config";
import { buildSignedParams } from "@/lib/integrations/aliexpress/auth";
import type {
  AliExpressRawProduct,
  AliExpressValidationResult,
} from "@/lib/integrations/aliexpress/types";

type ApiEnvelope = {
  error_response?: { msg?: string; sub_msg?: string; code?: string };
};

export class AliExpressAffiliateClient {
  constructor(
    private appKey: string,
    private appSecret: string,
    private trackingId?: string
  ) {}

  async validateCredentials(): Promise<AliExpressValidationResult> {
    const testedAt = new Date().toISOString();
    try {
      const batch = await this.call<{
        aliexpress_affiliate_product_query_response?: {
          resp_result?: { result?: { products?: AliExpressRawProduct[] } };
          resp_code?: number;
          resp_msg?: string;
        };
      }>("aliexpress.affiliate.product.query", {
        keywords: "phone",
        page_no: "1",
        page_size: "1",
        target_currency: "USD",
        target_language: "EN",
        ...(this.trackingId ? { tracking_id: this.trackingId } : {}),
      });

      const resp = batch.aliexpress_affiliate_product_query_response;
      if (resp?.resp_code && resp.resp_code !== 200) {
        return {
          ok: false,
          message: resp.resp_msg ?? `API returned code ${resp.resp_code}`,
          testedAt,
        };
      }

      return {
        ok: true,
        message: "AliExpress affiliate API credentials are valid.",
        testedAt,
      };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "Validation failed",
        testedAt,
      };
    }
  }

  /** Keyword search for live product discovery (search page). */
  async searchByKeyword(
    keyword: string,
    options?: { pageSize?: number; pageNo?: number; currency?: string }
  ): Promise<AliExpressRawProduct[]> {
    const pageSize = Math.min(Math.max(options?.pageSize ?? 24, 1), 50);
    const pageNo = options?.pageNo ?? 1;
    const currency = options?.currency ?? "USD";

    const batch = await this.call<{
      aliexpress_affiliate_product_query_response?: {
        resp_result?: {
          result?: {
            products?: AliExpressRawProduct[] | { product?: AliExpressRawProduct[] };
          };
        };
        resp_code?: number;
        resp_msg?: string;
      };
    }>("aliexpress.affiliate.product.query", {
      keywords: keyword.trim(),
      page_no: String(pageNo),
      page_size: String(pageSize),
      target_currency: currency,
      target_language: "EN",
      ...(this.trackingId ? { tracking_id: this.trackingId } : {}),
    });

    const resp = batch.aliexpress_affiliate_product_query_response;
    if (resp?.resp_code && resp.resp_code !== 200) {
      throw new Error(resp.resp_msg ?? `AliExpress API returned code ${resp.resp_code}`);
    }

    const productsNode = resp?.resp_result?.result?.products;
    const products = Array.isArray(productsNode)
      ? productsNode
      : productsNode?.product ?? [];

    return dedupeById(products);
  }

  async searchProducts(
    config: ImportJobConfig,
    currency: string
  ): Promise<AliExpressRawProduct[]> {
    const all: AliExpressRawProduct[] = [];
    const keywords = config.keywords ?? ["electronics"];
    const maxPages = config.maxPages ?? 2;
    const pageSize = config.pageSize ?? 20;

    for (const keyword of keywords) {
      for (let page = 1; page <= maxPages; page++) {
        const products = await this.searchByKeyword(keyword, {
          pageNo: page,
          pageSize,
          currency,
        });
        all.push(...products);
        if (products.length < pageSize) break;
      }
    }

    return dedupeById(all);
  }

  async getProductsByIds(ids: string[], currency: string): Promise<AliExpressRawProduct[]> {
    if (ids.length === 0) return [];

    const batch = await this.call<{
      aliexpress_affiliate_productdetail_get_response?: {
        resp_result?: { result?: { products?: AliExpressRawProduct[] } };
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

  /** Generate tracked promotion links for product URLs. */
  async generatePromotionLinks(sourceUrls: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (sourceUrls.length === 0) return result;

    const batch = await this.call<{
      aliexpress_affiliate_link_generate_response?: {
        resp_result?: {
          result?: {
            promotion_links?: { source_value?: string; promotion_link?: string }[];
          };
        };
      };
    }>("aliexpress.affiliate.link.generate", {
      promotion_link_type: "0",
      source_values: sourceUrls.slice(0, 50).join(","),
      ...(this.trackingId ? { tracking_id: this.trackingId } : {}),
    });

    const links =
      batch.aliexpress_affiliate_link_generate_response?.resp_result?.result
        ?.promotion_links ?? [];

    for (const link of links) {
      if (link.source_value && link.promotion_link) {
        result.set(link.source_value, link.promotion_link);
      }
    }

    return result;
  }

  private async call<T>(method: string, bizParams: Record<string, string>): Promise<T> {
    const params = buildSignedParams(method, this.appKey, this.appSecret, bizParams);
    const body = new URLSearchParams(params);

    const res = await fetch(ALIEXPRESS_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
      body: body.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`AliExpress API ${res.status}: ${text.slice(0, 300)}`);
    }

    const json = JSON.parse(text) as T & ApiEnvelope;
    if (json.error_response) {
      throw new Error(
        json.error_response.msg ??
          json.error_response.sub_msg ??
          `AliExpress API error (${json.error_response.code ?? "unknown"})`
      );
    }

    return json;
  }
}

function dedupeById(products: AliExpressRawProduct[]): AliExpressRawProduct[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const id = p.product_id ?? p.product_title ?? "";
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
