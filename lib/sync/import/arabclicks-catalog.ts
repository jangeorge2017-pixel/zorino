/**
 * ArabClicks universal product-feed sync → global multi-store schema.
 *
 * ArabClicks delivers ONE feed that can cover MANY stores (Noon, Jumia, H&M,
 * …) across MANY markets (EG, SA, AE, …). This module streams the feed (CSV or
 * XML — auto-detected) from its URL, maps every row to a real store offer, and
 * writes the global multi-store schema in two idempotent steps per item:
 *
 *   Step A — `products` upsert onConflict "global_sku"            → returns id
 *   Step B — `product_offers` upsert onConflict
 *            "product_id,store_name,country_code" (network = ArabClicks)
 *
 * Design:
 * - Field names vary per merchant/export, so CSV headers / XML tags are matched
 *   through normalized alias lists (`FIELD_ALIASES`) — a new merchant format
 *   usually needs zero code changes.
 * - One bad row (or one merchant exporting a broken format) is skipped and
 *   recorded in the result; it never aborts the run. Only feed-level failures
 *   (HTTP error, undecodable body, unparseable XML) throw.
 * - `global_sku` identity: feed barcode/GTIN when present (so the same product
 *   from two stores merges into one canonical row with two offers), otherwise
 *   the store-scoped SKU, otherwise a stable hash of store+country+brand+title.
 *   The `arabclicks:` prefix keeps these ids namespace-safe against other
 *   providers' raw ids (e.g. AliExpress numeric product ids).
 * - Memory is bounded: rows are parsed incrementally and written in batches;
 *   the full feed is never held in memory, so production-scale files are fine.
 * - Real data only: rows without a price, a store, a resolvable country, a
 *   currency or a valid destination URL are skipped (never fabricated).
 */

import { createHash } from "node:crypto";
import { toLatinNumerals } from "@/lib/international/arabic-numerals";
import type { SupabaseDb } from "@/lib/supabase/config";
import type { ExternalProduct } from "@/lib/sync/types";
import { slugifyTitle } from "@/lib/sync/providers/shared/product-utils";
import {
  upsertGlobalProduct,
  upsertProductOffer,
  type GlobalOfferIdentity,
} from "@/lib/sync/import/global-catalog";

/** Network identity written into `product_offers.network_name`. */
export const ARABCLICKS_NETWORK_NAME = "ArabClicks";

/**
 * `products.global_sku` namespace prefix. Mirrors `ARABCLICKS_NETWORK_ID`
 * (lib/integration/arabclicks.ts) — duplicated as a literal to keep this
 * module free of the catalog-saver import chain.
 */
const SKU_PREFIX = "arabclicks";

const MAX_ERROR_SAMPLES = 50;
const MAX_WARN_LOGS = 20;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_WRITE_CONCURRENCY = 6;
const DEFAULT_FETCH_TIMEOUT_MS = 300_000;
const MAX_XML_TAIL_BYTES = 4 * 1024 * 1024;
/** How far to read ahead to discover the XML record tag before parsing. */
const XML_SNIFF_MAX_BYTES = 256 * 1024;
const CSV_SNIFF_MAX_BYTES = 8_192;
const USER_AGENT = "ZorinoBot/1.0";

// ── Types ───────────────────────────────────────────────────────────────

export type ArabClicksFeedFormat = "csv" | "xml";

/** Normalized feed field map: lowercase alphanumeric key → raw value. */
export type FeedFieldMap = Record<string, string>;

export type ArabClicksFeedItem = {
  /** Canonical products.global_sku (namespaced). */
  globalSku: string;
  title: string;
  description: string | null;
  brand: string | null;
  imageUrl: string | null;
  categoryPath: string | null;
  /** Raw GTIN/EAN/UPC when the feed carries one. */
  barcode: string | null;
  storeName: string;
  countryCode: string;
  price: number;
  currency: string;
  affiliateUrl: string;
  productUrl: string | null;
  inStock: boolean;
};

export type ArabClicksRowContext = {
  /** 1-based data row index (header excluded) used in error samples. */
  rowIndex: number;
  defaultCountryCode?: string;
  defaultCurrency?: string;
  defaultStoreName?: string;
};

export type ArabClicksRowOutcome =
  | { ok: true; item: ArabClicksFeedItem }
  | { ok: false; reason: string };

export type ArabClicksSyncOptions = {
  /** Stop after this many data rows (default: whole feed). */
  maxItems?: number;
  /** Parse + map only — no database writes. */
  dryRun?: boolean;
  /** Wall-clock epoch ms after which the run stops cleanly. */
  deadlineMs?: number;
  /** Rows buffered per write batch (default 100). */
  batchSize?: number;
  /** Concurrent PostgREST write chains (default 6). */
  writeConcurrency?: number;
  /** Whole-response timeout for the feed fetch (default 300s). */
  fetchTimeoutMs?: number;
  /** Feed URL is single-market: fallback country (e.g. "EG") when the row omits it. */
  defaultCountryCode?: string;
  /** Feed URL is single-currency: fallback ISO code when the row omits it. */
  defaultCurrency?: string;
  /** Feed URL is single-merchant: fallback store name when the row omits it. */
  defaultStoreName?: string;
  /** Injected Supabase client (scripts/tests). Defaults to the service-role client. */
  supabase?: SupabaseDb;
};

export type ArabClicksSyncResult = {
  format: ArabClicksFeedFormat | "unknown";
  dryRun: boolean;
  /** Data rows parsed from the feed (header excluded). */
  rowsRead: number;
  /** Rows rejected by validation (missing price/store/country/currency/url). */
  skipped: number;
  /** Rows whose database write failed. */
  failed: number;
  /** Duplicate (global_sku, store, country) rows seen again in the same run. */
  duplicatesSkipped: number;
  productsUpserted: number;
  offersUpserted: number;
  /** Distinct store names discovered in the feed (sorted). */
  stores: string[];
  /** Distinct country codes discovered in the feed (sorted). */
  countries: string[];
  /** Capped sample of row/format errors (full counts live in skipped/failed). */
  errors: string[];
  stoppedReason: "done" | "deadline" | "max-items";
  durationMs: number;
};

type RawFeedRow = { rowIndex: number; fields: FeedFieldMap };

type FeedParser = {
  push(chunk: string): FeedFieldMap[];
  flush(): FeedFieldMap[];
};

// ── Field aliases ───────────────────────────────────────────────────────

const FIELD_ALIASES = {
  title: ["title", "name", "productname", "producttitle", "itemname", "itemtitle"],
  description: [
    "description",
    "productdescription",
    "longdescription",
    "desc",
    "details",
    "summary",
  ],
  brand: ["brand", "brandname", "manufacturer", "vendor"],
  imageUrl: [
    "imageurl",
    "imagelink",
    "mainimage",
    "productimage",
    "largeimage",
    "image",
    "picture",
    "photo",
    "thumbnail",
    "imgurl",
    "img",
  ],
  categoryPath: [
    "categorypath",
    "googleproductcategory",
    "productcategory",
    "producttype",
    "categoryname",
    "category",
    "cat",
    "vertical",
  ],
  barcode: ["barcode", "ean", "ean13", "upc", "gtin", "gtin8", "gtin12", "gtin13", "gtin14"],
  sku: [
    "sku",
    "skuid",
    "productsku",
    "merchantsku",
    "sellersku",
    "articlesku",
    "article",
    "articleid",
    "itemid",
    "offerid",
    "productid",
    "id",
    "code",
  ],
  store: [
    "storename",
    "store",
    "shopname",
    "shop",
    "merchantname",
    "merchant",
    "partnername",
    "partner",
    "advertisername",
    "advertiser",
    "sellername",
    "seller",
  ],
  country: [
    "countrycode",
    "country",
    "marketcode",
    "market",
    "countryname",
    "region",
    "geo",
  ],
  price: [
    "price",
    "saleprice",
    "finalprice",
    "priceincltax",
    "currentprice",
    "offerprice",
    "specialprice",
    "bestprice",
    "amount",
  ],
  currency: ["currencycode", "currency", "curr", "pricecurrency", "iso4217"],
  affiliateUrl: [
    "affiliateurl",
    "affiliatelink",
    "trackinglink",
    "trackingurl",
    "tracklink",
    "afflink",
    "clickurl",
    "deeplinkurl",
    "deeplink",
    "redirecturl",
    "tracking",
    "linkurl",
    "destinationurl",
    "offerurl",
    "url",
    "link",
  ],
  productUrl: [
    "producturl",
    "productlink",
    "productpageurl",
    "itemurl",
    "pageurl",
    "landingurl",
    "sourceurl",
  ],
  inStock: ["availability", "instock", "stockstatus", "stock", "inventory", "available"],
} as const satisfies Record<string, readonly string[]>;

/** Normalize a header/tag name: lowercase, letters + digits only. */
function normalizeKey(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function pickField(map: FeedFieldMap, aliases: readonly string[]): string | null {
  for (const key of aliases) {
    const value = map[key];
    if (value != null && value.trim() !== "") return value.trim();
  }
  return null;
}

// ── Country / currency normalization ────────────────────────────────────

const COUNTRY_NAME_CODES: Record<string, string> = {
  egypt: "EG",
  arabrepublicofegypt: "EG",
  egy: "EG",
  saudiarabia: "SA",
  kingdomofsaudiarabia: "SA",
  saudi: "SA",
  sau: "SA",
  ksa: "SA",
  unitedarabemirates: "AE",
  uae: "AE",
  emirates: "AE",
  are: "AE",
  qatar: "QA",
  qat: "QA",
  kuwait: "KW",
  kwt: "KW",
  bahrain: "BH",
  bhr: "BH",
  oman: "OM",
  omn: "OM",
  jordan: "JO",
  jor: "JO",
  morocco: "MA",
  mar: "MA",
  tunisia: "TN",
  tun: "TN",
  iraq: "IQ",
  irq: "IQ",
  lebanon: "LB",
  lbn: "LB",
  yemen: "YE",
  yem: "YE",
  libya: "LY",
  lby: "LY",
  algeria: "DZ",
  dza: "DZ",
  sudan: "SD",
  sdn: "SD",
  somalia: "SO",
  som: "SO",
  mauritania: "MR",
  mrt: "MR",
  djibouti: "DJ",
  dji: "DJ",
  palestine: "PS",
  pse: "PS",
  comoros: "KM",
  km: "KM",
  comores: "KM",
  turkey: "TR",
  turkiye: "TR",
  tur: "TR",
};

const ARABIC_COUNTRY_NAMES: Record<string, string> = {
  مصر: "EG",
  السعودية: "SA",
  "المملكة العربية السعودية": "SA",
  الإمارات: "AE",
  "الإمارات العربية المتحدة": "AE",
  قطر: "QA",
  الكويت: "KW",
  البحرين: "BH",
  عمان: "OM",
  عُمان: "OM",
  الأردن: "JO",
  المغرب: "MA",
  تونس: "TN",
  العراق: "IQ",
  لبنان: "LB",
  اليمن: "YE",
  ليبيا: "LY",
  الجزائر: "DZ",
  السودان: "SD",
  الصومال: "SO",
  موريتانيا: "MR",
  جيبوتي: "DJ",
  فلسطين: "PS",
  "جزر القمر": "KM",
  تركيا: "TR",
};

const COUNTRY_CURRENCY: Record<string, string> = {
  EG: "EGP",
  SA: "SAR",
  AE: "AED",
  KW: "KWD",
  QA: "QAR",
  BH: "BHD",
  OM: "OMR",
  JO: "JOD",
  MA: "MAD",
  TN: "TND",
  IQ: "IQD",
  LB: "LBP",
  YE: "YER",
  LY: "LYD",
  DZ: "DZD",
  SD: "SDG",
  SO: "SOS",
  MR: "MRU",
  DJ: "DJF",
  PS: "JOD",
  KM: "KMF",
  TR: "TRY",
};

/** Arabic currency symbols common to ArabClicks markets → ISO code. */
const CURRENCY_SYMBOL_CODES: Record<string, string> = {
  "ج.م": "EGP",
  "ر.س": "SAR",
  "د.إ": "AED",
  "د.ك": "KWD",
  "ر.ق": "QAR",
  "ر.ع": "OMR",
  "د.ب": "BHD",
  "د.أ": "JOD",
  "د.ت": "TND",
  "د.ج": "DZD",
  "ل.ل": "LBP",
};

/** Normalize a feed country value (ISO2 / ISO3 / English name / Arabic name). */
export function normalizeCountryCode(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const arabic = ARABIC_COUNTRY_NAMES[trimmed];
  if (arabic) return arabic;
  const key = normalizeKey(toLatinNumerals(trimmed));
  if (!key) return null;
  if (key.length === 2) return key.toUpperCase();
  return COUNTRY_NAME_CODES[key] ?? null;
}

function extractCurrencyHint(priceRaw: string): string | null {
  const text = toLatinNumerals(priceRaw).trim();
  const lead = text.match(/^([A-Za-z]{3})(?=[\s\d.,-])/);
  if (lead) return lead[1].toUpperCase();
  const trail = text.match(/[\s\d.,-]([A-Za-z]{3})$/);
  if (trail) return trail[1].toUpperCase();
  return null;
}

/** Normalize a currency value (ISO code, Arabic symbol, or embedded in the price). */
export function normalizeFeedCurrency(
  raw: string | null | undefined,
  priceRaw?: string | null,
): string | null {
  if (raw != null) {
    const text = toLatinNumerals(raw).trim();
    if (/^[A-Za-z]{3}$/.test(text)) return text.toUpperCase();
    // Symbols such as "ج.م" / "ر.س" keep their internal dots meaningful.
    const symbol = text.replace(/[\s\u200e\u200f]/g, "");
    const bySymbol = CURRENCY_SYMBOL_CODES[symbol];
    if (bySymbol) return bySymbol;
    // "EGP 1,299" / "Price in EGP" style cells.
    const words = text.match(/\b([A-Za-z]{3})\b/g);
    if (words) {
      for (const word of words) {
        const code = word.toUpperCase();
        if (code === "IN" || code === "THE") continue;
        return code;
      }
    }
  }
  return priceRaw ? extractCurrencyHint(priceRaw) : null;
}

// ── Price / stock parsing ───────────────────────────────────────────────

/**
 * Parse a feed price cell: strips currency letters/symbols, handles Arabic
 * digits, thousands separators and both decimal conventions.
 * Returns null for missing, non-numeric, ≤ 0 or absurd (> 1e9) values.
 */
export function parseFeedPrice(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let latin = toLatinNumerals(String(raw)).trim();
  if (!latin) return null;

  // Remove currency tokens FIRST: Arabic symbols like "ج.م" carry a dot that
  // would otherwise be mistaken for a decimal separator.
  for (const symbol of Object.keys(CURRENCY_SYMBOL_CODES)) {
    if (latin.includes(symbol)) latin = latin.split(symbol).join(" ");
  }
  latin = latin.replace(/\b[A-Za-z]{3}\b/g, " ");

  let core = latin.replace(/[^\d.,-]/g, "");
  if (!core || !/\d/.test(core)) return null;

  const hasComma = core.includes(",");
  const hasDot = core.includes(".");
  if (hasComma && hasDot) {
    // The separator appearing last is the decimal one; the other groups thousands.
    const decimal = core.lastIndexOf(",") > core.lastIndexOf(".") ? "," : ".";
    const thousands = decimal === "," ? "." : ",";
    core = core.split(thousands).join("");
    if (decimal === ",") core = core.replace(",", ".");
  } else if (hasComma) {
    const parts = core.split(",");
    if (parts.length > 2 || parts[1].length === 3) {
      core = parts.join("");
    } else {
      core = `${parts[0]}.${parts[1]}`;
    }
  } else if (hasDot) {
    const parts = core.split(".");
    if (parts.length > 2) core = parts.join("");
  }

  const value = Number.parseFloat(core);
  if (!Number.isFinite(value) || value <= 0 || value > 1e9) return null;
  return Math.round(value * 100) / 100;
}

const TRUE_TOKENS = new Set([
  "true",
  "yes",
  "y",
  "1",
  "in",
  "instock",
  "available",
  "availabletoday",
  "active",
  "on",
]);

const FALSE_TOKENS = new Set([
  "false",
  "no",
  "n",
  "0",
  "out",
  "outofstock",
  "soldout",
  "unavailable",
  "notavailable",
  "inactive",
  "off",
  "preorder",
  "backorder",
]);

/** `null` when the feed is silent about availability. */
export function parseFeedAvailability(raw: string | null | undefined): boolean | null {
  if (raw == null) return null;
  const key = normalizeKey(toLatinNumerals(raw));
  if (!key) return null;
  if (TRUE_TOKENS.has(key)) return true;
  if (FALSE_TOKENS.has(key)) return false;
  return null;
}

// ── Entity / URL helpers ────────────────────────────────────────────────

function decodeBasicEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
    .replace(/&amp;/g, "&");
}

function toValidHttpUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const text = raw.trim().replace(/^<|>$/g, "");
  if (!text) return null;
  const candidate = text.startsWith("//") ? `https:${text}` : text;
  if (!/^https?:\/\//i.test(candidate)) return null;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function firstHttpUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const first = raw.trim().split(/\s+/)[0];
  return toValidHttpUrl(first);
}

// ── Identity ────────────────────────────────────────────────────────────

function buildGlobalSku(parts: {
  barcode: string | null;
  sku: string | null;
  storeName: string;
  countryCode: string;
  brand: string | null;
  title: string;
}): string {
  const storeSlug = slugifyTitle(parts.storeName) || "store";
  if (parts.barcode) return `${SKU_PREFIX}:gtin:${parts.barcode}`;
  if (parts.sku) return `${SKU_PREFIX}:${storeSlug}:${parts.sku.slice(0, 128)}`;
  const hash = createHash("sha256")
    .update(
      [parts.storeName, parts.countryCode, parts.brand ?? "", parts.title].join("\u0000"),
    )
    .digest("hex")
    .slice(0, 16);
  return `${SKU_PREFIX}:${storeSlug}:h:${hash}`;
}

// ── Row mapping ─────────────────────────────────────────────────────────

/**
 * Map one normalized feed row to a validated store item. Returns a reason
 * (never throws) when the row cannot produce a real product/offer.
 */
export function mapFeedRowToItem(
  fields: FeedFieldMap,
  ctx: ArabClicksRowContext,
): ArabClicksRowOutcome {
  const title = pickField(fields, FIELD_ALIASES.title);
  if (!title) return { ok: false, reason: "missing product title" };

  const storeName =
    pickField(fields, FIELD_ALIASES.store) ?? ctx.defaultStoreName?.trim() ?? null;
  if (!storeName) return { ok: false, reason: "missing store name" };

  const countryCode =
    normalizeCountryCode(pickField(fields, FIELD_ALIASES.country)) ??
    normalizeCountryCode(ctx.defaultCountryCode ?? null);
  if (!countryCode) return { ok: false, reason: "missing/unknown country" };

  const priceRaw = pickField(fields, FIELD_ALIASES.price);
  const price = parseFeedPrice(priceRaw);
  if (price == null) {
    return {
      ok: false,
      reason: `invalid price${priceRaw ? ` "${priceRaw.slice(0, 32)}"` : ""}`,
    };
  }

  const currency =
    normalizeFeedCurrency(pickField(fields, FIELD_ALIASES.currency), priceRaw) ??
    normalizeFeedCurrency(ctx.defaultCurrency ?? null) ??
    COUNTRY_CURRENCY[countryCode] ??
    null;
  if (!currency) return { ok: false, reason: `missing currency for ${countryCode}` };

  const productUrl = toValidHttpUrl(pickField(fields, FIELD_ALIASES.productUrl));
  const affiliateUrl =
    toValidHttpUrl(pickField(fields, FIELD_ALIASES.affiliateUrl)) ?? productUrl;
  if (!affiliateUrl) return { ok: false, reason: "missing affiliate/product URL" };

  const barcode = pickField(fields, FIELD_ALIASES.barcode);
  const sku = pickField(fields, FIELD_ALIASES.sku);
  const brand = pickField(fields, FIELD_ALIASES.brand);

  return {
    ok: true,
    item: {
      globalSku: buildGlobalSku({ barcode, sku, storeName, countryCode, brand, title }),
      title,
      description: pickField(fields, FIELD_ALIASES.description),
      brand,
      imageUrl: firstHttpUrl(pickField(fields, FIELD_ALIASES.imageUrl)),
      categoryPath: pickField(fields, FIELD_ALIASES.categoryPath),
      barcode,
      storeName,
      countryCode,
      price,
      currency,
      affiliateUrl,
      productUrl,
      // Feed presence implies "available" unless the feed says otherwise.
      inStock: parseFeedAvailability(pickField(fields, FIELD_ALIASES.inStock)) ?? true,
    },
  };
}

function toExternalProduct(item: ArabClicksFeedItem): ExternalProduct {
  return {
    externalId: item.globalSku,
    title: item.title,
    // `slug` is not written by the global-schema writer (the live products
    // table has no slug column); it only satisfies the shared type.
    slug: slugifyTitle(item.title) || `arabclicks-${Date.now()}`,
    description: item.description ?? undefined,
    brand: item.brand ?? undefined,
    barcode: item.barcode ?? undefined,
    categorySlug: item.categoryPath ?? "",
    imageUrl: item.imageUrl ?? "",
    price: item.price,
    currency: item.currency,
    countryCode: item.countryCode,
    inStock: item.inStock,
    productUrl: item.productUrl ?? item.affiliateUrl,
    affiliateUrl: item.affiliateUrl,
  };
}

// ── CSV streaming parser ────────────────────────────────────────────────

function sniffDelimiter(headerLine: string): string {
  const withoutQuoted = headerLine.replace(/"[^"]*"/g, "");
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = 0;
  for (const candidate of candidates) {
    const count = withoutQuoted.split(candidate).length - 1;
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Incremental RFC-4180 CSV parser. Consumes chunks, emits one normalized
 * `FeedFieldMap` per data row (using the first row as the header). Handles
 * quoted fields, escaped quotes, embedded newlines/commas, CRLF, chunk
 * boundaries inside quotes, and header delimiter sniffing.
 */
export class CsvStreamParser implements FeedParser {
  private delimiter: string | null = null;
  private sniffBuffer = "";
  private field = "";
  private row: string[] = [];
  private inQuotes = false;
  private quoteEscapePending = false;
  private crPending = false;
  private headerKeys: string[] | null = null;

  push(chunk: string): FeedFieldMap[] {
    if (this.delimiter === null) {
      this.sniffBuffer += chunk;
      const newline = this.sniffBuffer.indexOf("\n");
      if (newline === -1) {
        if (this.sniffBuffer.length <= CSV_SNIFF_MAX_BYTES) return [];
        this.delimiter = ",";
        const rest = this.sniffBuffer;
        this.sniffBuffer = "";
        return this.parseChunk(rest);
      }
      this.delimiter = sniffDelimiter(this.sniffBuffer.slice(0, newline));
      const rest = this.sniffBuffer;
      this.sniffBuffer = "";
      return this.parseChunk(rest);
    }
    return this.parseChunk(chunk);
  }

  flush(): FeedFieldMap[] {
    if (this.delimiter === null) {
      if (this.sniffBuffer === "") return [];
      this.delimiter = ",";
      const rows = this.parseChunk(this.sniffBuffer);
      this.sniffBuffer = "";
      rows.push(...this.forceEndRow());
      return rows;
    }
    return this.forceEndRow();
  }

  private parseChunk(text: string): FeedFieldMap[] {
    const delimiter = this.delimiter ?? ",";
    const out: FeedFieldMap[] = [];
    let i = 0;

    if (this.crPending) {
      this.crPending = false;
      if (text.startsWith("\n")) i = 1;
      out.push(...this.endRow());
    }
    if (this.quoteEscapePending) {
      this.quoteEscapePending = false;
      if (text[i] === '"') {
        this.field += '"';
        i += 1;
      } else {
        this.inQuotes = false;
      }
    }

    for (; i < text.length; i++) {
      const ch = text[i];

      if (this.inQuotes) {
        if (ch === '"') {
          if (i + 1 < text.length) {
            if (text[i + 1] === '"') {
              this.field += '"';
              i += 1;
            } else {
              this.inQuotes = false;
            }
          } else {
            this.quoteEscapePending = true;
          }
        } else {
          this.field += ch;
        }
        continue;
      }

      if (ch === '"' && this.field === "") {
        this.inQuotes = true;
      } else if (ch === delimiter) {
        this.row.push(this.field);
        this.field = "";
      } else if (ch === "\r") {
        if (i + 1 < text.length) {
          if (text[i + 1] === "\n") i += 1;
          out.push(...this.endRow());
        } else {
          this.crPending = true;
        }
      } else if (ch === "\n") {
        out.push(...this.endRow());
      } else {
        this.field += ch;
      }
    }

    return out;
  }

  private forceEndRow(): FeedFieldMap[] {
    if (this.field === "" && this.row.length === 0) return [];
    return this.endRow();
  }

  private endRow(): FeedFieldMap[] {
    this.row.push(this.field);
    const cells = this.row;
    this.field = "";
    this.row = [];

    if (this.headerKeys === null) {
      this.headerKeys = cells.map((cell) => normalizeKey(cell));
      return [];
    }
    if (cells.length === 1 && cells[0].trim() === "") return [];

    const map: FeedFieldMap = {};
    for (let c = 0; c < this.headerKeys.length; c++) {
      const key = this.headerKeys[c];
      if (!key) continue;
      const value = decodeBasicEntities(cells[c] ?? "");
      if (map[key] === undefined || map[key] === "") map[key] = value;
    }
    return [map];
  }
}

// ── XML streaming parser ────────────────────────────────────────────────

const XML_ITEM_TAG_CANDIDATES = ["item", "product", "offer", "entry", "productitem"] as const;

/**
 * Sniff the repeated record tag from the accumulated XML head. Returns `null`
 * when no candidate is present yet (caller keeps reading until
 * `XML_SNIFF_MAX_BYTES`), so a tag split across chunk boundaries is not
 * mistaken for a missing one.
 */
function findXmlItemTag(head: string): string | null {
  for (const tag of XML_ITEM_TAG_CANDIDATES) {
    if (new RegExp(`<(?:[\\w.-]+:)?${tag}[\\s>/]`, "i").test(head)) return tag;
  }
  return null;
}

function stripCData(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("<![CDATA[") && trimmed.endsWith("]]>")) {
    return trimmed.slice("<![CDATA[".length, -"]]>".length);
  }
  return trimmed;
}

/** Extract child tags of one XML item block into a normalized field map. */
export function extractXmlFields(block: string): FeedFieldMap {
  const map: FeedFieldMap = {};
  const childRe = /<([\w:.-]+)(?:\s[^>]*)?>([\s\S]*?)<\/\1\s*>/g;
  let match: RegExpExecArray | null;
  while ((match = childRe.exec(block)) !== null) {
    const name = match[1];
    const colon = name.lastIndexOf(":");
    const key = normalizeKey(colon >= 0 ? name.slice(colon + 1) : name);
    if (!key || map[key] !== undefined) continue;
    map[key] = decodeBasicEntities(stripCData(match[2]));
  }
  return map;
}

/**
 * Incremental XML feed parser: extracts complete `<item>`/`<product>`/
 * `<offer>`/`<entry>` blocks as they stream in (namespace-prefix aware,
 * CDATA-aware) and keeps only the trailing partial block in memory.
 */
export class XmlFeedParser implements FeedParser {
  private buffer = "";
  private readonly itemTag: string;

  constructor(itemTag: string = "item") {
    this.itemTag = itemTag;
  }

  push(chunk: string): FeedFieldMap[] {
    this.buffer += chunk;
    return this.consume(false);
  }

  flush(): FeedFieldMap[] {
    const rows = this.consume(true);
    this.buffer = "";
    return rows;
  }

  private consume(final: boolean): FeedFieldMap[] {
    const tag = this.itemTag;
    const blockRe = new RegExp(
      `<(?:[\\w.-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`,
      "g",
    );
    const rows: FeedFieldMap[] = [];
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    while ((match = blockRe.exec(this.buffer)) !== null) {
      rows.push(extractXmlFields(match[1]));
      lastEnd = blockRe.lastIndex;
    }
    if (lastEnd > 0) this.buffer = this.buffer.slice(lastEnd);

    if (!final && this.buffer.length > MAX_XML_TAIL_BYTES) {
      throw new Error(
        `ArabClicks XML feed: no complete <${tag}> block in ${MAX_XML_TAIL_BYTES} bytes — malformed feed`,
      );
    }

    // Drop prolog/junk before the trailing partial block.
    const openRe = new RegExp(`<(?:[\\w.-]+:)?${tag}[\\s>/]`);
    const open = openRe.exec(this.buffer);
    if (open && open.index > 0) this.buffer = this.buffer.slice(open.index);

    return rows;
  }
}

// ── Feed fetch / detection ──────────────────────────────────────────────

function validateFeedUrl(raw: string): string {
  const text = (raw ?? "").trim();
  if (!text) throw new Error("syncArabClicksFeed: feedUrl is required");
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error("syncArabClicksFeed: feedUrl is not a valid URL");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("syncArabClicksFeed: feedUrl must be http(s)");
  }
  return text;
}

function redactFeedUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.protocol}//${url.host}/[redacted]`;
  } catch {
    return "[invalid-url]";
  }
}

function detectFeedFormat(
  head: string,
  contentType: string,
  feedUrl: string,
): ArabClicksFeedFormat {
  const trimmed = head.replace(/^\uFEFF/, "").trimStart();
  if (trimmed.startsWith("<")) return "xml";
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    throw new Error("ArabClicks feed appears to be JSON — expected CSV or XML");
  }
  if (/xml|rss|atom/i.test(contentType)) return "xml";
  if (/csv/i.test(contentType)) return "csv";
  try {
    const path = new URL(feedUrl).pathname.toLowerCase();
    if (path.endsWith(".xml")) return "xml";
  } catch {
    /* ignore */
  }
  return "csv";
}

async function* streamFeedRows(
  feedUrl: string,
  opts: {
    fetchTimeoutMs: number;
    onFormat?: (format: ArabClicksFeedFormat) => void;
  },
): AsyncGenerator<RawFeedRow> {
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(opts.fetchTimeoutMs),
  });
  if (!response.ok) throw new Error(`ArabClicks feed HTTP ${response.status}`);
  if (!response.body) throw new Error("ArabClicks feed: response body is null");

  const reader = response.body.getReader();
  try {
    const first = await reader.read();
    if (first.done) throw new Error("ArabClicks feed: empty response");

    const firstBytes = first.value;
    let decoder = new TextDecoder("utf-8");
    if (firstBytes.length >= 2) {
      if (firstBytes[0] === 0xff && firstBytes[1] === 0xfe) {
        decoder = new TextDecoder("utf-16le");
      } else if (firstBytes[0] === 0xfe && firstBytes[1] === 0xff) {
        decoder = new TextDecoder("utf-16be");
      }
    }
    let head = decoder.decode(firstBytes, { stream: true });
    if (head.charCodeAt(0) === 0xfeff) head = head.slice(1);

    const format = detectFeedFormat(head, response.headers.get("content-type") ?? "", feedUrl);
    opts.onFormat?.(format);
    console.log(`[arabclicks-feed] detected ${format.toUpperCase()} feed`);

    let rowIndex = 0;
    function* emit(maps: FeedFieldMap[]): Generator<RawFeedRow> {
      for (const fields of maps) {
        rowIndex += 1;
        yield { rowIndex, fields };
      }
    }

    async function* readRest(): AsyncGenerator<string> {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    }

    let parser: FeedParser;
    if (format === "xml") {
      // The record tag can be preceded by a long prolog/namespace block and
      // split across chunks, so read ahead until it is discovered (or capped).
      let xmlHead = head;
      let itemTag = findXmlItemTag(xmlHead);
      while (!itemTag && xmlHead.length < XML_SNIFF_MAX_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        xmlHead += decoder.decode(value, { stream: true });
        itemTag = findXmlItemTag(xmlHead);
      }
      parser = new XmlFeedParser(itemTag ?? "item");
      yield* emit(parser.push(xmlHead));
    } else {
      parser = new CsvStreamParser();
      yield* emit(parser.push(head));
    }

    for await (const chunk of readRest()) {
      yield* emit(parser.push(chunk));
    }
    yield* emit(parser.flush());
  } finally {
    try {
      await reader.cancel();
    } catch {
      /* already closed */
    }
  }
}

// ── Concurrency helper ──────────────────────────────────────────────────

async function runConcurrent<T>(
  items: readonly T[],
  workers: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const runner = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await fn(items[index]);
    }
  };
  const poolSize = Math.max(1, Math.min(workers, items.length));
  const runners: Promise<void>[] = [];
  for (let i = 0; i < poolSize; i++) runners.push(runner());
  await Promise.all(runners);
}

// ── Entry point ─────────────────────────────────────────────────────────

/**
 * Fetch, parse and import an ArabClicks universal product feed into the global
 * multi-store schema.
 *
 * Per item:
 *   Step A: upsert `products` onConflict `global_sku` → retrieve `id`
 *   Step B: upsert `product_offers` onConflict
 *           `product_id,store_name,country_code` with networkName `ArabClicks`
 *
 * Row-level failures never abort the run. Throws only when the feed itself
 * cannot be fetched/parsed (HTTP error, empty body, malformed XML).
 */
export async function syncArabClicksFeed(
  feedUrl: string,
  options: ArabClicksSyncOptions = {},
): Promise<ArabClicksSyncResult> {
  const startedAt = Date.now();
  const {
    maxItems = Number.POSITIVE_INFINITY,
    dryRun = false,
    deadlineMs,
    batchSize = DEFAULT_BATCH_SIZE,
    writeConcurrency = DEFAULT_WRITE_CONCURRENCY,
    fetchTimeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
    defaultCountryCode,
    defaultCurrency,
    defaultStoreName,
  } = options;

  const url = validateFeedUrl(feedUrl);

  let supabase = options.supabase ?? null;
  if (!supabase && !dryRun) {
    const { createSupabaseServiceClient } = await import("@/lib/supabase/server");
    supabase = createSupabaseServiceClient();
    if (!supabase) {
      throw new Error(
        "syncArabClicksFeed: Supabase service client unavailable (SUPABASE_SERVICE_ROLE_KEY missing)",
      );
    }
  }

  const result: ArabClicksSyncResult = {
    format: "unknown",
    dryRun,
    rowsRead: 0,
    skipped: 0,
    failed: 0,
    duplicatesSkipped: 0,
    productsUpserted: 0,
    offersUpserted: 0,
    stores: [],
    countries: [],
    errors: [],
    stoppedReason: "done",
    durationMs: 0,
  };

  const stores = new Set<string>();
  const countries = new Set<string>();
  const seenOffers = new Set<string>();
  let warnedErrors = 0;

  const noteError = (rowIndex: number, message: string) => {
    if (result.errors.length < MAX_ERROR_SAMPLES) {
      result.errors.push(`row ${rowIndex}: ${message}`);
    }
    if (warnedErrors < MAX_WARN_LOGS) {
      warnedErrors += 1;
      console.warn(`[arabclicks-feed] row ${rowIndex}: ${message}`);
    }
  };

  console.log(`[arabclicks-feed] sync start (${redactFeedUrl(url)})`);

  const pending: RawFeedRow[] = [];

  const processBatch = async (): Promise<void> => {
    if (pending.length === 0) return;
    const batch = pending.splice(0, pending.length);
    await runConcurrent(batch, writeConcurrency, async (row) => {
      const outcome = mapFeedRowToItem(row.fields, {
        rowIndex: row.rowIndex,
        defaultCountryCode,
        defaultCurrency,
        defaultStoreName,
      });
      if (!outcome.ok) {
        result.skipped += 1;
        noteError(row.rowIndex, outcome.reason);
        return;
      }

      const item = outcome.item;
      const offerKey = `${item.globalSku}\u0000${item.storeName}\u0000${item.countryCode}`;
      if (seenOffers.has(offerKey)) {
        result.duplicatesSkipped += 1;
        return;
      }
      seenOffers.add(offerKey);
      stores.add(item.storeName);
      countries.add(item.countryCode);

      if (dryRun) {
        result.productsUpserted += 1;
        result.offersUpserted += 1;
        return;
      }

      try {
        const product = toExternalProduct(item);
        const identity: GlobalOfferIdentity = {
          storeName: item.storeName,
          networkName: ARABCLICKS_NETWORK_NAME,
          countryCode: item.countryCode,
        };

        // Step A — canonical product (products.global_sku).
        const productId = await upsertGlobalProduct(supabase!, product);
        result.productsUpserted += 1;

        // Step B — per-store offer (product_id, store_name, country_code).
        await upsertProductOffer(supabase!, productId, product, identity);
        result.offersUpserted += 1;
      } catch (err) {
        result.failed += 1;
        noteError(
          row.rowIndex,
          `write failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    });
  };

  try {
    for await (const row of streamFeedRows(url, {
      fetchTimeoutMs,
      onFormat: (format) => {
        result.format = format;
      },
    })) {
      if (deadlineMs != null && Date.now() > deadlineMs) {
        result.stoppedReason = "deadline";
        break;
      }
      if (result.rowsRead >= maxItems) {
        result.stoppedReason = "max-items";
        break;
      }
      result.rowsRead += 1;
      pending.push(row);
      if (pending.length >= batchSize) await processBatch();
    }
    await processBatch();
  } finally {
    result.durationMs = Date.now() - startedAt;
    result.stores = Array.from(stores).sort();
    result.countries = Array.from(countries).sort();
    console.log(
      `[arabclicks-feed] done: rows=${result.rowsRead} products=${result.productsUpserted} ` +
        `offers=${result.offersUpserted} skipped=${result.skipped} failed=${result.failed} ` +
        `stopped=${result.stoppedReason} in ${result.durationMs}ms`,
    );
  }

  return result;
}
