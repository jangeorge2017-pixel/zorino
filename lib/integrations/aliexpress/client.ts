import type { ImportJobConfig } from "@/lib/sync/providers/shared/import-config";
import { ALIEXPRESS_API_URL } from "@/lib/integrations/aliexpress/config";
import { buildSignedParams } from "@/lib/integrations/aliexpress/auth";
import { logAliExpress, maskSecret } from "@/lib/integrations/aliexpress/logger";
import type {
  AliExpressRawProduct,
  AliExpressValidationResult,
} from "@/lib/integrations/aliexpress/types";

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
    options?: { pageSize?: number; pageNo?: number; currency?: string }
  ): Promise<AliExpressRawProduct[]> {
    const pageSize = Math.min(Math.max(options?.pageSize ?? 24, 1), 50);
    const pageNo = options?.pageNo ?? 1;
    const currency = options?.currency ?? "USD";

    logAliExpress("searchByKeyword start", { keyword, pageSize, pageNo, currency });

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
      keywords: keyword.trim(),
      page_no: String(pageNo),
      page_size: String(pageSize),
      target_currency: currency,
      target_language: "EN",
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

    logAliExpress("FULL API REQUEST", {
      url: ALIEXPRESS_API_URL,
      httpMethod: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      params,
      body: body.toString(),
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

    logAliExpress("FULL API RESPONSE", {
      method,
      httpStatus: res.status,
      httpStatusText: res.statusText,
      body: text,
    });

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

function dedupeById(products: AliExpressRawProduct[]): AliExpressRawProduct[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    const id = String(p.product_id ?? p.product_title ?? "");
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
