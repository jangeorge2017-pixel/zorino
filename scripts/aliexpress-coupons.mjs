#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const API_URL = "https://api-sg.aliexpress.com/sync";
const DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_KEYWORDS = [
  "phone case",
  "wireless earbuds",
  "usb cable",
  "gaming mouse",
  "shoes",
  "dress",
  "smart watch",
  "led light",
  "kitchen gadget",
  "home decor",
  "power bank",
  "backpack",
  "makeup",
  "bluetooth speaker",
  "tablet",
  "laptop",
  "tools",
  "garden",
  "pet supplies",
  "car accessories",
  "headphones",
  "charger",
  "keyboard",
  "camera",
  "toys",
  "jewelry",
  "sunglasses",
  "hair",
  "nail",
  "fitness",
];
const PRODUCT_FIELDS = [
  "product_id",
  "product_title",
  "product_detail_url",
  "promotion_link",
  "sale_price",
  "sale_price_currency",
  "original_price",
  "original_price_currency",
  "discount",
  "promo_code_info",
  "first_level_category_name",
].join(",");

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function intEnv(name, fallback, min, max) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function shanghaiTimestamp() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}

function signParams(params, secret) {
  const sorted = Object.keys(params)
    .filter((key) => key !== "sign" && params[key] !== "")
    .sort();
  let base = secret;
  for (const key of sorted) base += key + params[key];
  base += secret;
  return crypto.createHash("md5").update(base, "utf8").digest("hex").toUpperCase();
}

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

function parseDate(value) {
  if (!value) return null;
  const normalized = String(value).trim().replace(" ", "T");
  if (!normalized) return null;
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(normalized);
  const date = new Date(hasZone ? normalized : `${normalized}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function numberFrom(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseDiscount(info) {
  const text = String(info?.code_value ?? "").trim();
  const percent = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percent) {
    const value = numberFrom(percent[1]);
    return value > 0 ? { value, type: "percentage" } : null;
  }
  const fixed =
    text.match(/get\s+(?:USD|US\$|\$)?\s*([\d.,]+)\s*off/i) ??
    text.match(/(?:USD|US\$|\$)\s*([\d.,]+)\s*off/i);
  if (fixed) {
    const value = numberFrom(fixed[1]);
    return value > 0 ? { value, type: "fixed" } : null;
  }
  return null;
}

function resolveCurrency(info, product) {
  const fromOffer = String(info?.code_value ?? "").match(/\b([A-Z]{3})\b/);
  if (fromOffer) return fromOffer[1];
  const fromProduct = String(product?.sale_price_currency ?? "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(fromProduct) ? fromProduct : "USD";
}

function extractProducts(payload, method) {
  const key = `${method.replace(/\./g, "_")}_response`;
  const response = payload?.[key];
  const node = response?.resp_result?.result?.products;
  if (Array.isArray(node)) return node;
  if (Array.isArray(node?.product)) return node.product;
  if (node?.product && typeof node.product === "object") return [node.product];
  return [];
}

function responseError(payload, method) {
  const key = `${method.replace(/\./g, "_")}_response`;
  const response = payload?.[key];
  const code = response?.resp_code ?? response?.resp_result?.resp_code;
  const message = response?.resp_msg ?? response?.resp_result?.resp_msg;
  if (code != null && Number(code) !== 200) {
    return `${message ?? "AliExpress API error"} (code ${code})`;
  }
  return null;
}

async function callAliExpress(config, method, bizParams) {
  const params = {
    method,
    app_key: config.appKey,
    sign_method: "md5",
    timestamp: shanghaiTimestamp(),
    format: "json",
    v: "2.0",
    ...bizParams,
  };
  params.sign = signParams(params, config.appSecret);

  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
        body: new URLSearchParams(params).toString(),
        signal: AbortSignal.timeout(20_000),
      });
      const text = await response.text();
      if (response.status === 429 || response.status >= 500) {
        throw new Error(`AliExpress HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      if (!response.ok) {
        throw new Error(`AliExpress HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw new Error(`AliExpress returned non-JSON: ${text.slice(0, 300)}`);
      }
      if (payload?.error_response) {
        const err = payload.error_response;
        throw new Error(
          [err.code ? `code=${err.code}` : null, err.msg, err.sub_msg]
            .filter(Boolean)
            .join(" | ") || "AliExpress error_response",
        );
      }
      const businessError = responseError(payload, method);
      if (businessError) throw new Error(businessError);
      return payload;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt === 4) break;
      await sleep(Math.min(1_500 * 2 ** (attempt - 1), 8_000));
    }
  }
  throw lastError ?? new Error(`AliExpress request failed: ${method}`);
}

function buildCoupons(products) {
  const now = Date.now();
  const byCode = new Map();
  let skippedNoCode = 0;
  let skippedNoUrl = 0;
  let skippedNoDiscount = 0;
  let skippedExpired = 0;

  for (const product of products) {
    const info = product?.promo_code_info;
    const code = String(info?.promo_code ?? "").trim();
    if (!code) {
      skippedNoCode += 1;
      continue;
    }
    const affiliateUrl = String(product?.promotion_link ?? "").trim();
    if (!/^https?:\/\//i.test(affiliateUrl)) {
      skippedNoUrl += 1;
      continue;
    }
    const discount = parseDiscount(info);
    if (!discount) {
      skippedNoDiscount += 1;
      continue;
    }
    const endsAt = parseDate(info?.code_availabletime_end);
    if (!endsAt || endsAt.getTime() <= now) {
      skippedExpired += 1;
      continue;
    }
    if (byCode.has(code)) continue;

    const startsAt = parseDate(info?.code_availabletime_start) ?? new Date(now);
    const currency = resolveCurrency(info, product);
    const minSpendValue = numberFrom(info?.code_mini_spend);
    const minSpend =
      minSpendValue > 0 ? `Min. spend ${currency} ${minSpendValue.toFixed(2)}` : null;
    const discountLabel =
      discount.type === "percentage"
        ? `${discount.value}% off`
        : `${currency} ${discount.value.toFixed(2)} off`;
    const title = minSpend
      ? `${discountLabel} on orders over ${currency} ${minSpendValue.toFixed(2)}`
      : `${discountLabel} on AliExpress`;
    const isActive = startsAt.getTime() <= now && endsAt.getTime() > now;

    byCode.set(code, {
      store_id: null,
      external_id: `aliexpress:${code}`,
      campaign_id: null,
      code,
      title,
      offer: discountLabel,
      description: product?.product_title ? String(product.product_title).slice(0, 500) : null,
      category: product?.first_level_category_name
        ? String(product.first_level_category_name)
        : null,
      min_spend: minSpend,
      affiliate_url: affiliateUrl,
      logo_url: null,
      discount: discount.value,
      discount_type: discount.type,
      currency,
      country_code: "US",
      source: "aliexpress",
      coupon_type: "promocode",
      exclusive: false,
      verified: true,
      is_active: isActive,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    });
  }

  return {
    rows: [...byCode.values()],
    skippedNoCode,
    skippedNoUrl,
    skippedNoDiscount,
    skippedExpired,
  };
}

function getApiConfig() {
  return {
    appKey: required("ALIEXPRESS_APP_KEY"),
    appSecret: required("ALIEXPRESS_APP_SECRET"),
    trackingId: required("ALIEXPRESS_TRACKING_ID"),
  };
}

function getSupabaseConfig() {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    key: required("SUPABASE_SERVICE_ROLE_KEY"),
  };
}

async function fetchProducts(config) {
  const keywords = (process.env.ALIEXPRESS_COUPON_KEYWORDS ?? "")
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean);
  const searchKeywords = keywords.length > 0 ? keywords : DEFAULT_KEYWORDS;
  const pages = intEnv("ALIEXPRESS_COUPON_PAGES", 2, 1, 5);
  const pageSize = intEnv("ALIEXPRESS_COUPON_PAGE_SIZE", 50, 1, 50);
  const gapMs = intEnv("ALIEXPRESS_COUPON_REQUEST_GAP_MS", 350, 0, 5_000);
  const products = new Map();
  const failures = [];

  for (const keyword of searchKeywords) {
    for (let page = 1; page <= pages; page++) {
      try {
        const payload = await callAliExpress(config, "aliexpress.affiliate.product.query", {
          keywords: keyword,
          page_no: String(page),
          page_size: String(pageSize),
          target_currency: "USD",
          target_language: "EN",
          ship_to_country: "US",
          tracking_id: config.trackingId,
          fields: PRODUCT_FIELDS,
        });
        for (const product of extractProducts(payload, "aliexpress.affiliate.product.query")) {
          const id = String(product?.product_id ?? "");
          if (id) products.set(id, product);
        }
      } catch (error) {
        failures.push(
          `${keyword} page ${page}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (gapMs > 0) await sleep(gapMs);
    }
  }

  if (products.size === 0 && failures.length > 0) {
    throw new Error(`AliExpress product queries failed: ${failures.slice(0, 3).join("; ")}`);
  }

  return {
    products: [...products.values()],
    failures,
    requests: searchKeywords.length * pages,
  };
}

async function main() {
  loadEnvLocal();
  const config = getApiConfig();
  const fetched = await fetchProducts(config);
  const built = buildCoupons(fetched.products);

  console.log(
    `AliExpress coupons: ${fetched.products.length} products from ${fetched.requests} requests, ` +
      `${built.rows.length} active coupon codes`,
  );
  console.log(
    `Skipped: no-code=${built.skippedNoCode}, no-url=${built.skippedNoUrl}, ` +
      `no-discount=${built.skippedNoDiscount}, expired=${built.skippedExpired}`,
  );
  if (fetched.failures.length > 0) {
    console.warn(`AliExpress request failures: ${fetched.failures.length}`);
    for (const failure of fetched.failures.slice(0, 5)) console.warn(`  ${failure}`);
  }

  if (DRY_RUN) {
    for (const row of built.rows) {
      console.log(
        `${row.code} | ${row.offer} | ${row.min_spend ?? "no minimum"} | ends ${row.ends_at}`,
      );
    }
    console.log("Dry run: no database writes.");
    return;
  }

  const supabaseConfig = getSupabaseConfig();
  const supabase = createClient(supabaseConfig.url, supabaseConfig.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: store, error: storeError } = await supabase
    .from("stores")
    .select("id, slug")
    .eq("slug", "aliexpress")
    .eq("is_active", true)
    .maybeSingle();
  if (storeError) throw new Error(`AliExpress store lookup failed: ${storeError.message}`);
  if (!store?.id) throw new Error("Active AliExpress store not found");

  const rows = built.rows.map((row) => ({ ...row, store_id: store.id }));
  if (rows.length > 0) {
    const { data, error } = await supabase
      .from("coupons")
      .upsert(rows, { onConflict: "external_id" })
      .select("id, code, is_active");
    if (error) throw new Error(`Coupon upsert failed: ${error.message}`);
    console.log(`Upserted ${data?.length ?? rows.length} AliExpress coupons.`);
  }

  const nowIso = new Date().toISOString();
  const { data: expired, error: expiredError } = await supabase
    .from("coupons")
    .select("id")
    .eq("source", "aliexpress")
    .eq("is_active", true)
    .lt("ends_at", nowIso);
  if (expiredError) throw new Error(`Expired coupon scan failed: ${expiredError.message}`);
  const expiredIds = (expired ?? []).map((row) => row.id);
  if (expiredIds.length > 0) {
    const { error } = await supabase
      .from("coupons")
      .update({ is_active: false })
      .in("id", expiredIds);
    if (error) throw new Error(`Expired coupon deactivation failed: ${error.message}`);
    console.log(`Deactivated ${expiredIds.length} expired AliExpress coupons.`);
  }

  console.log("AliExpress coupon sync complete.");
}

try {
  await main();
} catch (error) {
  console.error(`AliExpress coupon sync failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
