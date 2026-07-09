/**
 * Phase 2 diagnostic: live AliExpress search for fixed queries.
 * Prints search input → request → response summary → mapped products.
 * Does not print secrets.
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const APP_KEY = process.env.ALIEXPRESS_APP_KEY?.trim();
const APP_SECRET = process.env.ALIEXPRESS_APP_SECRET?.trim();
const TRACKING_ID = process.env.ALIEXPRESS_TRACKING_ID?.trim();
const API_URL = "https://api-sg.aliexpress.com/sync";

function mask(v) {
  if (!v) return "(empty)";
  if (v.length <= 6) return `${v.slice(0, 1)}***`;
  return `${v.slice(0, 4)}…${v.slice(-4)} (len=${v.length})`;
}

function formatTimestamp(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")} ${hour}:${get("minute")}:${get("second")}`;
}

function sign(params, secret) {
  const sorted = Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== "")
    .sort();
  let base = secret;
  for (const key of sorted) base += key + params[key];
  base += secret;
  return createHash("md5").update(base, "utf8").digest("hex").toUpperCase();
}

function extractProducts(productsNode) {
  if (!productsNode) return [];
  if (Array.isArray(productsNode)) return productsNode;
  if (Array.isArray(productsNode.product)) return productsNode.product;
  return [];
}

/** Same relevance rules we will apply in the data layer. */
function queryTokens(query) {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s.+-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function isRelevant(title, query) {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return false;
  const hay = title.toLowerCase();
  return tokens.every((t) => hay.includes(t));
}

async function search(query) {
  const biz = {
    keywords: query.trim(),
    page_no: "1",
    page_size: "24",
    target_currency: "USD",
    target_language: "EN",
    ...(TRACKING_ID ? { tracking_id: TRACKING_ID } : {}),
  };

  const params = {
    method: "aliexpress.affiliate.product.query",
    app_key: APP_KEY,
    sign_method: "md5",
    timestamp: formatTimestamp(),
    format: "json",
    v: "2.0",
    ...biz,
  };
  params.sign = sign(params, APP_SECRET);

  const requestForReport = {
    url: API_URL,
    method: "POST",
    params: {
      ...params,
      app_key: mask(params.app_key),
      sign: `${params.sign.slice(0, 8)}…${params.sign.slice(-8)}`,
    },
  };

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: new URLSearchParams(params).toString(),
  });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return {
      searchInput: query,
      request: requestForReport,
      httpStatus: res.status,
      apiError: `Non-JSON: ${text.slice(0, 400)}`,
      rawProducts: [],
      mappedProducts: [],
      relevantMapped: [],
    };
  }

  if (json.error_response) {
    return {
      searchInput: query,
      request: requestForReport,
      httpStatus: res.status,
      apiError: json.error_response,
      fullResponseKeys: Object.keys(json),
      rawProducts: [],
      mappedProducts: [],
      relevantMapped: [],
    };
  }

  const resp = json.aliexpress_affiliate_product_query_response;
  const productsNode = resp?.resp_result?.result?.products;
  const raw = extractProducts(productsNode);

  const mapped = raw.map((p) => ({
    id: p.product_id != null ? String(p.product_id) : null,
    title: p.product_title ?? null,
    price: p.target_sale_price ?? null,
    originalPrice: p.target_original_price ?? null,
    affiliateLink: p.promotion_link || p.product_detail_url || null,
    rating: p.evaluate_rate ?? null,
    sales: p.lastest_volume ?? null,
    store: p.shop_title ?? "AliExpress",
    relevant: isRelevant(p.product_title ?? "", query),
  }));

  return {
    searchInput: query,
    request: requestForReport,
    httpStatus: res.status,
    resp_code: resp?.resp_code ?? resp?.resp_result?.resp_code,
    resp_msg: resp?.resp_msg ?? resp?.resp_result?.resp_msg,
    total_record_count: resp?.resp_result?.result?.total_record_count,
    current_record_count: resp?.resp_result?.result?.current_record_count,
    rawCount: raw.length,
    mappedProducts: mapped,
    relevantMapped: mapped.filter((m) => m.relevant),
    irrelevantTitles: mapped.filter((m) => !m.relevant).map((m) => m.title),
  };
}

const queries = ["iPhone", "Samsung S24", "MacBook", "AirPods"];

console.log("=== Phase 2 AliExpress search diagnostic ===");
console.log(
  JSON.stringify(
    {
      credentials: {
        ALIEXPRESS_APP_KEY: mask(APP_KEY),
        ALIEXPRESS_APP_SECRET: mask(APP_SECRET),
        ALIEXPRESS_TRACKING_ID: mask(TRACKING_ID),
        configured: Boolean(APP_KEY && APP_SECRET),
      },
    },
    null,
    2
  )
);

if (!APP_KEY || !APP_SECRET) {
  console.error("MISSING CREDENTIALS — cannot call live API");
  process.exit(1);
}

const reports = [];
for (const q of queries) {
  const report = await search(q);
  reports.push(report);
  console.log("\n" + "=".repeat(60));
  console.log(JSON.stringify(report, null, 2));
}

const summary = reports.map((r) => ({
  query: r.searchInput,
  keywordsSent: r.request?.params?.keywords,
  httpStatus: r.httpStatus,
  apiError: r.apiError ?? null,
  rawCount: r.rawCount ?? 0,
  relevantCount: r.relevantMapped?.length ?? 0,
  topRelevant: (r.relevantMapped ?? []).slice(0, 5).map((p) => p.title),
  topIrrelevant: (r.irrelevantTitles ?? []).slice(0, 5),
}));

console.log("\n=== SUMMARY ===");
console.log(JSON.stringify(summary, null, 2));
