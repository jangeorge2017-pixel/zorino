import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { ALIEXPRESS_API_URL } from "@/lib/integrations/aliexpress/config";
import { buildSignedParams } from "@/lib/integrations/aliexpress/auth";
import {
  logAliExpress,
  maskSecret,
  redactRequestForLog,
} from "@/lib/integrations/aliexpress/logger";
import type {
  AliExpressRawProduct,
  AliExpressValidationResult,
} from "@/lib/integrations/aliexpress/types";

/** Explicit Open Platform fields required by ZORINO product cards + affiliate links. */
export const ALIEXPRESS_PRODUCT_FIELDS = [
  "product_id",
  "product_title",
  "product_main_image_url",
  "product_small_image_urls",
  "product_detail_url",
  "promotion_link",
  "target_sale_price",
  "target_original_price",
  "target_sale_price_currency",
  "sale_price",
  "original_price",
  "sale_price_currency",
  "discount",
  "evaluate_rate",
  "lastest_volume",
  "first_level_category_name",
  "shop_id",
  "shop_title",
  "shop_url",
  "ship_to_days",
].join(",");

type ApiEnvelope = {
  error_response?: {
    msg?: string;
    sub_msg?: string;
    code?: string;
    request_id?: string;
  };
};

function isAuthOrSignatureError(message: string, code?: string): boolean {
  const haystack = `${code ?? ""} ${message}`.toLowerCase();
  return (
    haystack.includes("sign") ||
    haystack.includes("signature") ||
    haystack.includes("invalid app") ||
    haystack.includes("appkey") ||
    haystack.includes("app_key") ||
    haystack.includes("auth") ||
    haystack.includes("permission") ||
    haystack.includes("isp.invalid") ||
    haystack.includes("isv.") ||
    code === "27" ||
    code === "25" ||
    code === "26"
  );
}

function extractProducts(
  productsNode: AliExpressRawProduct[] | { product?: AliExpressRawProduct[] } | undefined
): AliExpressRawProduct[] {
  if (!productsNode) return [];
  if (Array.isArray(productsNode)) return productsNode;
  if (Array.isArray(productsNode.product)) return productsNode.product;
  return [];
}

export class AliExpressAffiliateClient {
  constructor(
    private appKey: string,
    private appSecret: string,
    private trackingId?: string
  ) {
    logAliExpress("client constructed", {
      appKeyMasked: maskSecret(appKey),
      appSecretMasked: maskSecret(appSecret),
      hasTrackingId: Boolean(trackingId?.trim()),
      trackingIdMasked: maskSecret(trackingId),
      apiUrl: ALIEXPRESS_API_URL,
    });
  }

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
        ship_to_country: "US",
        fields: ALIEXPRESS_PRODUCT_FIELDS,
        ...(this.trackingId ? { tracking_id: this.trackingId } : {}),
      });

      const resp = batch.aliexpress_affiliate_product_query_response;
      if (resp?.resp_code && resp.resp_code !== 200) {
        const message = resp.resp_msg ?? `API returned code ${resp.resp_code}`;
        logAliExpress("credential validation failed (resp_code)", {
          resp_code: resp.resp_code,
          resp_msg: resp.resp_msg,
        });
        return { ok: false, message, testedAt };
      }

      return {
        ok: true,
        message: "AliExpress affiliate API credentials are valid.",
        testedAt,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      logAliExpress("credential validation error", { message });
      return { ok: false, message, testedAt };
    }
  }

  /** Keyword search for live product discovery (search page). */
  async searchByKeyword(
    keyword: string,
    options?: {
      pageSize?: number;
      pageNo?: number;
      currency?: string;
      shipToCountry?: string;
    }
  ): Promise<AliExpressRawProduct[]> {
    const pageSize = Math.min(Math.max(options?.pageSize ?? 24, 1), 50);
    const pageNo = options?.pageNo ?? 1;
    const currency = options?.currency ?? "USD";
    const shipToCountry = options?.shipToCountry?.trim() || "US";

    // Exact user query — no rewrite, no default/demo keywords.
    const keywords = keyword.trim();
    logAliExpress("searchByKeyword start", {
      keywords,
      pageSize,
      pageNo,
      currency,
      shipToCountry,
      hasTrackingId: Boolean(this.trackingId?.trim()),
    });

    const batch = await this.call<{
      aliexpress_affiliate_product_query_response?: {
        resp_result?: {
          result?: {
            products?: AliExpressRawProduct[] | { product?: AliExpressRawProduct[] };
            current_record_count?: number | string;
            total_record_count?: number | string;
          };
          resp_code?: number;
          resp_msg?: string;
        };
        resp_code?: number;
        resp_msg?: string;
      };
    }>("aliexpress.affiliate.product.query", {
      keywords,
      page_no: String(pageNo),
      page_size: String(pageSize),
      target_currency: currency,
      target_language: "EN",
      ship_to_country: shipToCountry,
      fields: ALIEXPRESS_PRODUCT_FIELDS,
      ...(this.trackingId ? { tracking_id: this.trackingId } : {}),
    });

    const resp = batch.aliexpress_affiliate_product_query_response;
    const respCode = resp?.resp_code ?? resp?.resp_result?.resp_code;
    const respMsg = resp?.resp_msg ?? resp?.resp_result?.resp_msg;

    if (respCode != null && Number(respCode) !== 200) {
      const message = respMsg ?? `AliExpress API returned code ${respCode}`;
      logAliExpress("searchByKeyword business error", {
        resp_code: respCode,
        resp_msg: respMsg,
        fullResponse: batch,
      });
      if (isAuthOrSignatureError(message, String(respCode))) {
        logAliExpress("AUTHENTICATION / SIGNATURE ERROR", {
          resp_code: respCode,
          resp_msg: respMsg,
        });
      }
      throw new Error(message);
    }

    const productsNode = resp?.resp_result?.result?.products;
    const products = extractProducts(productsNode);

    logAliExpress("searchByKeyword success", {
      keyword,
      productCount: products.length,
      current_record_count: resp?.resp_result?.result?.current_record_count,
      total_record_count: resp?.resp_result?.result?.total_record_count,
    });

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
        resp_result?: {
          result?: {
            products?: AliExpressRawProduct[] | { product?: AliExpressRawProduct[] };
          };
          resp_code?: number;
          resp_msg?: string;
        };
        resp_code?: number;
        resp_msg?: string;
      };
    }>("aliexpress.affiliate.productdetail.get", {
      product_ids: ids.slice(0, 50).join(","),
      target_currency: currency,
      target_language: "EN",
      ship_to_country: "US",
      fields: ALIEXPRESS_PRODUCT_FIELDS,
      ...(this.trackingId ? { tracking_id: this.trackingId } : {}),
    });

    const resp = batch.aliexpress_affiliate_productdetail_get_response;
    const respCode = resp?.resp_code ?? resp?.resp_result?.resp_code;
    const respMsg = resp?.resp_msg ?? resp?.resp_result?.resp_msg;
    if (respCode != null && Number(respCode) !== 200) {
      const message = respMsg ?? `AliExpress productdetail code ${respCode}`;
      logAliExpress("getProductsByIds business error", {
        resp_code: respCode,
        resp_msg: respMsg,
        fullResponse: batch,
      });
      throw new Error(message);
    }

    return extractProducts(resp?.resp_result?.result?.products);
  }

  /** Generate tracked promotion links for product URLs. */
  async generatePromotionLinks(sourceUrls: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    if (sourceUrls.length === 0) return result;

    const trackingId = this.trackingId?.trim();
    if (!trackingId) {
      logAliExpress("generatePromotionLinks skipped — ALIEXPRESS_TRACKING_ID missing");
      return result;
    }

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
      tracking_id: trackingId,
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
    const maxAttempts = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.callOnce<T>(method, bizParams);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lastError = error instanceof Error ? error : new Error(message);
        const retryable = isRateLimitOrTransientError(message);
        logAliExpress("API call failed", {
          method,
          attempt,
          maxAttempts,
          retryable,
          message,
        });
        if (!retryable || attempt === maxAttempts) break;
        const delayMs = 400 * attempt * attempt;
        await sleep(delayMs);
      }
    }

    throw lastError ?? new Error(`AliExpress API call failed: ${method}`);
  }

  private async callOnce<T>(method: string, bizParams: Record<string, string>): Promise<T> {
    const params = buildSignedParams(method, this.appKey, this.appSecret, bizParams);
    const body = new URLSearchParams(params);

    logAliExpress("API REQUEST", {
      url: ALIEXPRESS_API_URL,
      httpMethod: "POST",
      method,
      params: redactRequestForLog(params),
    });

    let res: Response;
    try {
      res = await fetch(ALIEXPRESS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: body.toString(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logAliExpress("NETWORK ERROR calling AliExpress API", { message, method });
      throw new Error(`AliExpress network error: ${message}`);
    }

    const text = await res.text();

    logAliExpress("API RESPONSE", {
      method,
      httpStatus: res.status,
      httpStatusText: res.statusText,
      bodyLength: text.length,
    });

    if (res.status === 429 || res.status === 503) {
      throw new Error(`AliExpress rate limit / unavailable HTTP ${res.status}: ${text}`);
    }

    if (!res.ok) {
      const message = `AliExpress API HTTP ${res.status}: ${text}`;
      logAliExpress("HTTP ERROR", { message });
      if (isAuthOrSignatureError(message)) {
        logAliExpress("AUTHENTICATION / SIGNATURE ERROR (HTTP)", { message });
      }
      throw new Error(message);
    }

    let json: T & ApiEnvelope;
    try {
      json = JSON.parse(text) as T & ApiEnvelope;
    } catch {
      const message = `AliExpress API returned non-JSON body: ${text.slice(0, 500)}`;
      logAliExpress("PARSE ERROR", { message });
      throw new Error(message);
    }

    if (json.error_response) {
      const err = json.error_response;
      const message = [
        err.code ? `code=${err.code}` : null,
        err.msg,
        err.sub_msg,
        err.request_id ? `request_id=${err.request_id}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      logAliExpress("API error_response (exact)", {
        error_response: err,
        message,
        fullResponse: json,
      });

      if (isAuthOrSignatureError(message, err.code)) {
        logAliExpress("AUTHENTICATION / SIGNATURE ERROR", {
          code: err.code,
          msg: err.msg,
          sub_msg: err.sub_msg,
          request_id: err.request_id,
        });
      }

      throw new Error(message || "AliExpress API error_response");
    }

    return json;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitOrTransientError(message: string): boolean {
  const haystack = message.toLowerCase();
  return (
    haystack.includes("rate limit") ||
    haystack.includes("too many") ||
    haystack.includes("http 429") ||
    haystack.includes("http 503") ||
    haystack.includes("timeout") ||
    haystack.includes("network error") ||
    haystack.includes("econnreset") ||
    haystack.includes("etimedout") ||
    haystack.includes("flow limit") ||
    haystack.includes("isp.remote-service-timeout")
  );
}

function dedupeById(products: AliExpressRawProduct[]): AliExpressRawProduct[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const id = String(p.product_id ?? p.product_title ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
