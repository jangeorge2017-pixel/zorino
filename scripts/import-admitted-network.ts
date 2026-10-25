#!/usr/bin/env node
/**
 * Strict Admitad-only ingestion.
 *
 * Reads the two master files from the project root:
 *   1. master_programms.xlsx  — 82 approved merchants + tracking parameters
 *   2. coupons_feed.csv       — live coupon/action feed (semicolon delimited)
 *
 * Then:
 *   - upserts ONLY the approved merchants into `stores`
 *   - links ONLY coupons whose campaign/site matches an approved merchant
 *   - upserts those coupons into `coupons` (Admitad coupon id = identity)
 *   - deactivates coupons/stores that are no longer in the approved master
 *
 * Usage:
 *   node scripts/import-admitted-network.ts
 *   node scripts/import-admitted-network.ts --dry-run
 *   node scripts/import-admitted-network.ts --batch-size=100
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { parse as parseCsv } from "csv-parse/sync";
import XLSX from "xlsx";

// ---------------------------------------------------------------------------
// CLI + environment
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const DRY_RUN = argv.includes("--dry-run");
const batchArg = argv.find((arg) => arg.startsWith("--batch-size="));
const BATCH_SIZE = Math.max(
  1,
  Math.min(200, Number(batchArg?.split("=")[1] ?? 50) || 50),
);

const ROOT = process.cwd();
const PROGRAMS_FILE = resolve(ROOT, "master_programms.xlsx");
const COUPONS_FILE = resolve(ROOT, "coupons_feed.csv");
const MANIFEST_FILE = resolve(ROOT, "data", "admitted-network.json");

function loadEnvLocal(): void {
  const envPath = resolve(ROOT, ".env.local");
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

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------
type ProgramRow = {
  id: number | string;
  name: string | null;
  site_url: string;
  status: string;
  campaign_url: string | null;
  date_start: string | null;
  gotolink: string | null;
  category: string | null;
  region: string | null;
  action_ranges: string | null;
  cr: string | number | null;
  ecpc: string | number | null;
  epc: string | number | null;
  avg_hold_time: string | number | null;
  avg_money_transfer_time: string | number | null;
  rating: string | number | null;
  negative_keywords: string | null;
};

type CouponRow = Record<string, string>;

type ApprovedProgram = {
  campaignId: string;
  name: string;
  slug: string;
  siteUrl: string;
  regions: string[];
  categories: string[];
  currencyHints: string[];
};

type StoreUpsert = {
  name: string;
  slug: string;
  website: string;
  logo_url: string | null;
  logo_initial: string;
  integration_type: "partner";
  affiliate_program: "admitad";
  admitted_network: "admitad";
  admitted_campaign_id: string;
  external_store_id: string;
  commission_rate: number;
  supported_regions: string[];
  supported_currencies: string[];
  api_config: Record<string, unknown>;
  is_active: boolean;
};

type CouponUpsert = {
  store_id: string;
  external_id: string;
  campaign_id: string;
  code: string;
  title: string;
  offer: string;
  description: string | null;
  category: string | null;
  coupon_type: string;
  affiliate_url: string | null;
  logo_url: string | null;
  discount: number;
  discount_type: "percentage" | "fixed";
  currency: string;
  country_code: string | null;
  source: "admitad";
  exclusive: boolean;
  used_times: number;
  verified: boolean;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
};

type Manifest = {
  generatedAt: string;
  sourceFiles: { programs: string; coupons: string };
  programCount: number;
  couponCount: number;
  couponStoreCount: number;
  programs: Array<{
    id: string;
    name: string;
    slug: string;
    siteUrl: string;
    logoUrl: string | null;
  }>;
};

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------
const REGION_CODE: Record<string, string> = {
  "united states": "US",
  "united states of america": "US",
  "united kingdom": "GB",
  uk: "GB",
  uae: "AE",
  "united arab emirates": "AE",
  "saudi arabia": "SA",
  germany: "DE",
  france: "FR",
  spain: "ES",
  portugal: "PT",
  italy: "IT",
  netherlands: "NL",
  belgium: "BE",
  austria: "AT",
  ireland: "IE",
  switzerland: "CH",
  sweden: "SE",
  denmark: "DK",
  finland: "FI",
  norway: "NO",
  poland: "PL",
  "czech republic": "CZ",
  slovakia: "SK",
  hungary: "HU",
  romania: "RO",
  bulgaria: "BG",
  croatia: "HR",
  greece: "GR",
  ukraine: "UA",
  russia: "RU",
  turkey: "TR",
  kazakhstan: "KZ",
  israel: "IL",
  canada: "CA",
  mexico: "MX",
  brazil: "BR",
  argentina: "AR",
  chile: "CL",
  colombia: "CO",
  peru: "PE",
  india: "IN",
  pakistan: "PK",
  bangladesh: "BD",
  indonesia: "ID",
  malaysia: "MY",
  singapore: "SG",
  thailand: "TH",
  vietnam: "VN",
  philippines: "PH",
  "hong kong": "HK",
  taiwan: "TW",
  china: "CN",
  japan: "JP",
  "south korea": "KR",
  australia: "AU",
  "new zealand": "NZ",
  "south africa": "ZA",
  egypt: "EG",
  kuwait: "KW",
  qatar: "QA",
  oman: "OM",
  bahrain: "BH",
  jordan: "JO",
  lebanon: "LB",
  morocco: "MA",
  nigeria: "NG",
  kenya: "KE",
};

const REGION_CURRENCY: Record<string, string> = {
  US: "USD",
  GB: "GBP",
  AE: "AED",
  SA: "SAR",
  DE: "EUR",
  FR: "EUR",
  ES: "EUR",
  PT: "EUR",
  IT: "EUR",
  NL: "EUR",
  BE: "EUR",
  AT: "EUR",
  IE: "EUR",
  FI: "EUR",
  GR: "EUR",
  SK: "EUR",
  HR: "EUR",
  CA: "CAD",
  MX: "MXN",
  BR: "BRL",
  IN: "INR",
  CZ: "CZK",
  PL: "PLN",
  TR: "TRY",
  RU: "RUB",
  KW: "KWD",
  QA: "QAR",
  OM: "OMR",
  JO: "JOD",
  PK: "PKR",
  ID: "IDR",
  UA: "UAH",
  ZA: "ZAR",
  AU: "AUD",
  JP: "JPY",
  SG: "SGD",
  HK: "HKD",
  CH: "CHF",
  EG: "EGP",
};

const TLD_CURRENCY: Record<string, string> = {
  ae: "AED",
  sa: "SAR",
  eg: "EGP",
  uk: "GBP",
  de: "EUR",
  fr: "EUR",
  es: "EUR",
  pt: "EUR",
  it: "EUR",
  nl: "EUR",
  be: "EUR",
  at: "EUR",
  ie: "EUR",
  fi: "EUR",
  gr: "EUR",
  sk: "EUR",
  cz: "CZK",
  pl: "PLN",
  tr: "TRY",
  ru: "RUB",
  br: "BRL",
  in: "INR",
  mx: "MXN",
  ca: "CAD",
  au: "AUD",
  jp: "JPY",
  sg: "SGD",
  hk: "HKD",
  ch: "CHF",
  id: "IDR",
  za: "ZAR",
  kw: "KWD",
  qa: "QAR",
  om: "OMR",
  jo: "JOD",
  pk: "PKR",
  ua: "UAH",
};

const TLD_COUNTRY: Record<string, string> = {
  ae: "AE",
  sa: "SA",
  eg: "EG",
  uk: "GB",
  de: "DE",
  fr: "FR",
  es: "ES",
  pt: "PT",
  it: "IT",
  nl: "NL",
  be: "BE",
  at: "AT",
  ie: "IE",
  fi: "FI",
  gr: "GR",
  sk: "SK",
  cz: "CZ",
  pl: "PL",
  tr: "TR",
  ru: "RU",
  br: "BR",
  in: "IN",
  mx: "MX",
  ca: "CA",
  au: "AU",
  jp: "JP",
  sg: "SG",
  hk: "HK",
  ch: "CH",
  id: "ID",
  za: "ZA",
  kw: "KW",
  qa: "QA",
  om: "OM",
  jo: "JO",
  pk: "PK",
  ua: "UA",
};

function cleanText(value: unknown): string {
  return String(value ?? "").replace(/\u00a0/g, " ").trim();
}

function splitList(value: unknown): string[] {
  return cleanText(value)
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeSiteKey(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
  }
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function toHttps(url: string): string {
  return url.trim().replace(/^http:\/\//i, "https://");
}

function nameFromSite(siteUrl: string): string {
  try {
    const host = new URL(siteUrl).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] ?? host;
    return label.charAt(0).toUpperCase() + label.slice(1);
  } catch {
    return siteUrl;
  }
}

function initials(name: string): string {
  return (name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2) || "AD").toUpperCase();
}

function parseDate(raw: string | null | undefined): number | null {
  const value = cleanText(raw);
  if (!value || value.toLowerCase() === "none") return null;
  const iso = value.includes("T") ? value : value.replace(" ", "T");
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`;
  const time = Date.parse(withZone);
  return Number.isNaN(time) ? null : time;
}

function toIso(time: number | null): string | null {
  return time == null ? null : new Date(time).toISOString();
}

function parseBoolean(raw: unknown): boolean {
  return cleanText(raw).toLowerCase() === "true";
}

function parseNumber(raw: unknown): number | null {
  const text = cleanText(raw).replace(",", ".");
  if (!text) return null;
  const value = Number(text);
  return Number.isFinite(value) ? value : null;
}

function parseDiscount(raw: string): { value: number; type: "percentage" | "fixed" } {
  const text = cleanText(raw);
  if (!text) return { value: 0, type: "fixed" };

  const percent = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  if (percent) {
    return { value: Number(percent[1].replace(",", ".")), type: "percentage" };
  }

  const amountMatch = text.match(/\d[\d\s.,]*/);
  if (!amountMatch) return { value: 0, type: "fixed" };
  const amount = amountMatch[0]
    .replace(/\s+/g, "")
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(",", ".");
  const value = Number(amount);
  return { value: Number.isFinite(value) ? value : 0, type: "fixed" };
}

const TITLE_CURRENCY_RE =
  /(?:^|[^A-Z])(JPY|USD|EUR|GBP|INR|AED|SAR|BRL|CAD|AUD|SGD|MXN|PLN|CZK|TRY|RUB|KWD|QAR|OMR|JOD|PKR|EGP|IDR|UAH|ZAR|HKD|CHF)(?=[^A-Z]|$)/;

function inferCurrency(row: CouponRow, program: ApprovedProgram): string {
  const discount = cleanText(row.discount);
  // The feed's `discount` symbol is sometimes mangled (e.g. Klook's "6 000 R"
  // for a 6000 JPY offer), while the coupon title carries the real ISO code.
  const fromTitle = cleanText(row.name).match(TITLE_CURRENCY_RE);
  if (fromTitle) return fromTitle[1];

  const siteHost = (() => {
    try {
      return new URL(row.site).hostname.toLowerCase();
    } catch {
      return cleanText(row.site).toLowerCase();
    }
  })();

  const explicit: Array<[RegExp, string]> = [
    [/R\$/i, "BRL"],
    [/₹|₨/, "INR"],
    [/₽/, "RUB"],
    [/₺/, "TRY"],
    [/Kč/i, "CZK"],
    [/zł/i, "PLN"],
    [/AED|Dh(s)?\b/i, "AED"],
    [/\bJD\b/i, "JOD"],
    [/\bKD\b/i, "KWD"],
    [/\bQR\b/i, "QAR"],
    [/€/, "EUR"],
    [/£/, "GBP"],
  ];
  for (const [pattern, currency] of explicit) {
    if (pattern.test(discount)) {
      if (currency === "INR" && /₨/.test(discount) && siteHost.endsWith(".pk")) return "PKR";
      return currency;
    }
  }

  if (/\$/.test(discount) || !discount) {
    if (siteHost.endsWith(".mx")) return "MXN";
    if (siteHost.endsWith(".br")) return "BRL";
    if (siteHost.endsWith(".ca")) return "CAD";
    if (siteHost.endsWith(".au")) return "AUD";
    if (siteHost.endsWith(".sg")) return "SGD";
    if (siteHost.endsWith(".hk")) return "HKD";
    if (siteHost.endsWith(".za")) return "ZAR";
    if (siteHost.endsWith(".ae")) return "AED";
    if (siteHost.endsWith(".sa")) return "SAR";
    if (siteHost.endsWith(".in")) return "INR";
  }

  if (/\bR\b/.test(discount) && /\.br$/.test(siteHost)) return "BRL";

  const tld = siteHost.split(".").pop() ?? "";
  const tldCurrency = TLD_CURRENCY[tld];
  if (tldCurrency) return tldCurrency;

  for (const region of program.regions) {
    const code = REGION_CODE[region.toLowerCase()];
    const currency = code ? REGION_CURRENCY[code] : undefined;
    if (currency) return currency;
  }

  return "USD";
}

function inferCountryCode(
  row: CouponRow,
  program: ApprovedProgram,
  allowedCountries: Set<string>,
): string | null {
  const siteHost = (() => {
    try {
      return new URL(row.site).hostname.toLowerCase();
    } catch {
      return cleanText(row.site).toLowerCase();
    }
  })();

  const tld = siteHost.split(".").pop() ?? "";
  const candidate = TLD_COUNTRY[tld];
  if (candidate && allowedCountries.has(candidate)) return candidate;

  if (program.regions.length === 1) {
    const code = REGION_CODE[program.regions[0].toLowerCase()];
    if (code && allowedCountries.has(code)) return code;
  }

  return null;
}

function normalizeRegions(raw: string | null): string[] {
  const regions = splitList(raw);
  if (regions.length === 0) return [];
  if (regions.some((region) => region.toLowerCase() === "all")) return ["GLOBAL"];
  if (regions.length >= 100) return ["GLOBAL"];

  const codes = new Set<string>();
  for (const region of regions) {
    const code = REGION_CODE[region.toLowerCase()];
    if (code) codes.add(code);
  }
  return [...codes];
}

// ---------------------------------------------------------------------------
// File parsing
// ---------------------------------------------------------------------------
function readPrograms(): ProgramRow[] {
  if (!existsSync(PROGRAMS_FILE)) {
    throw new Error(`Missing ${PROGRAMS_FILE}`);
  }
  const workbook = XLSX.readFile(PROGRAMS_FILE);
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("master_programms.xlsx has no sheets");
  const rows = XLSX.utils.sheet_to_json<ProgramRow>(workbook.Sheets[sheetName], {
    defval: null,
  });
  return rows;
}

function readCoupons(): CouponRow[] {
  if (!existsSync(COUPONS_FILE)) {
    throw new Error(`Missing ${COUPONS_FILE}`);
  }
  const raw = readFileSync(COUPONS_FILE, "utf8");
  return parseCsv(raw, {
    delimiter: ";",
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    bom: true,
  }) as CouponRow[];
}

function buildApprovedPrograms(rows: ProgramRow[]): ApprovedProgram[] {
  const approved: ApprovedProgram[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const campaignId = cleanText(row.id);
    const status = cleanText(row.status).toLowerCase();
    const siteUrl = cleanText(row.site_url);
    if (!campaignId || !siteUrl) continue;
    if (status && status !== "active") continue;
    if (seen.has(campaignId)) continue;
    seen.add(campaignId);

    const name = cleanText(row.name) || nameFromSite(siteUrl);
    approved.push({
      campaignId,
      name,
      slug: `admitad-${campaignId}`,
      siteUrl: toHttps(siteUrl),
      regions: splitList(row.region),
      categories: splitList(row.category),
      currencyHints: [],
    });
  }

  return approved;
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------
function buildStores(
  programs: ApprovedProgram[],
  programRows: Map<string, ProgramRow>,
  couponsByCampaign: Map<string, CouponRow[]>,
): StoreUpsert[] {
  return programs.map((program) => {
    const row = programRows.get(program.campaignId) ?? ({} as ProgramRow);
    const couponRows = couponsByCampaign.get(program.campaignId) ?? [];
    const logoUrl = couponRows.map((coupon) => cleanText(coupon.logo)).find(Boolean) ?? null;
    const currencies = new Set<string>();
    for (const coupon of couponRows) currencies.add(inferCurrency(coupon, program));

    return {
      name: program.name,
      slug: program.slug,
      website: program.siteUrl,
      logo_url: logoUrl,
      logo_initial: initials(program.name),
      integration_type: "partner",
      affiliate_program: "admitad",
      admitted_network: "admitad",
      admitted_campaign_id: program.campaignId,
      external_store_id: program.campaignId,
      commission_rate: 0,
      supported_regions: normalizeRegions(cleanText(row.region)),
      supported_currencies: currencies.size > 0 ? [...currencies] : [],
      api_config: {
        status: cleanText(row.status) || "active",
        campaign_url: cleanText(row.campaign_url) || null,
        date_start: cleanText(row.date_start) || null,
        categories: program.categories,
        action_ranges: cleanText(row.action_ranges) || null,
        cr: parseNumber(row.cr),
        ecpc: parseNumber(row.ecpc),
        epc: parseNumber(row.epc),
        avg_hold_time: parseNumber(row.avg_hold_time),
        avg_money_transfer_time: parseNumber(row.avg_money_transfer_time),
        rating: parseNumber(row.rating),
        negative_keywords: cleanText(row.negative_keywords) || null,
        regions: program.regions,
        source: "master_programms.xlsx",
      },
      is_active: true,
    };
  });
}

function buildCoupons(
  programs: ApprovedProgram[],
  coupons: CouponRow[],
  allowedCountries: Set<string>,
): { rows: CouponUpsert[]; unmatched: number; skipped: number } {
  const programById = new Map(programs.map((program) => [program.campaignId, program]));
  const programBySite = new Map(
    programs.map((program) => [normalizeSiteKey(program.siteUrl), program]),
  );

  const now = Date.now();
  const rows: CouponUpsert[] = [];
  let unmatched = 0;
  let skipped = 0;

  for (const coupon of coupons) {
    const campaignId = cleanText(coupon.advcampaign_id);
    const program =
      programById.get(campaignId) ??
      programBySite.get(normalizeSiteKey(cleanText(coupon.site)));
    if (!program) {
      unmatched += 1;
      continue;
    }

    const externalId = cleanText(coupon.id);
    const title = cleanText(coupon.name);
    if (!externalId || !title) {
      skipped += 1;
      continue;
    }

    const startsAt = parseDate(coupon.date_start) ?? now;
    const endsAt = parseDate(coupon.date_end);
    const isActive = endsAt == null || endsAt >= now;
    const { value, type } = parseDiscount(coupon.discount);
    const currency = inferCurrency(coupon, program);

    rows.push({
      store_id: "",
      external_id: externalId,
      campaign_id: program.campaignId,
      code: cleanText(coupon.promocode) || "NO CODE",
      title,
      offer: title,
      description: cleanText(coupon.description) || null,
      category: cleanText(coupon.categories) || null,
      coupon_type: cleanText(coupon.species) || "promocode",
      affiliate_url: cleanText(coupon.gotolink) || cleanText(coupon.promolink) || null,
      logo_url: cleanText(coupon.logo) || null,
      discount: value,
      discount_type: type,
      currency,
      country_code: inferCountryCode(coupon, program, allowedCountries),
      source: "admitad",
      exclusive: parseBoolean(coupon.exclusive),
      used_times: 0,
      verified: true,
      is_active: isActive,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: toIso(endsAt) ?? "2099-12-31T23:59:59.000Z",
    });
  }

  return { rows, unmatched, skipped };
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------
type ServiceClient = SupabaseClient<any, "public", any>;

function getClient(): ServiceClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as ServiceClient;
}

function chunks<T>(items: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    output.push(items.slice(index, index + size));
  }
  return output;
}

async function loadAllowedCountries(client: ServiceClient): Promise<Set<string>> {
  const { data, error } = await client.from("countries").select("code");
  if (error) {
    console.warn(`   countries lookup failed (${error.message}); country_code left null`);
    return new Set();
  }
  return new Set(((data ?? []) as Array<{ code: string }>).map((row) => row.code));
}

async function upsertStores(
  client: ServiceClient,
  stores: StoreUpsert[],
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  let written = 0;

  for (const batch of chunks(stores, BATCH_SIZE)) {
    const { data, error } = await client
      .from("stores")
      .upsert(batch, { onConflict: "slug" })
      .select("id, external_store_id");
    if (error) throw new Error(`stores upsert failed: ${error.message}`);
    for (const row of (data ?? []) as Array<{ id: string; external_store_id: string | null }>) {
      if (row.external_store_id) ids.set(row.external_store_id, row.id);
    }
    written += data?.length ?? 0;
    process.stdout.write(`\r   stores upserted: ${written}/${stores.length}`);
  }

  // PostgREST can omit unchanged rows from the upsert response; resolve any
  // remaining campaign ids with a direct read.
  const missing = stores
    .map((store) => store.admitted_campaign_id)
    .filter((campaignId) => !ids.has(campaignId));
  if (missing.length > 0) {
    for (const batch of chunks(missing, BATCH_SIZE)) {
      const { data, error } = await client
        .from("stores")
        .select("id, external_store_id")
        .in("external_store_id", batch);
      if (error) throw new Error(`stores lookup failed: ${error.message}`);
      for (const row of (data ?? []) as Array<{ id: string; external_store_id: string | null }>) {
        if (row.external_store_id) ids.set(row.external_store_id, row.id);
      }
    }
  }

  console.log(`\n   stores resolved: ${ids.size}/${stores.length}`);
  return ids;
}

async function upsertCoupons(
  client: ServiceClient,
  coupons: CouponUpsert[],
): Promise<number> {
  let written = 0;
  for (const batch of chunks(coupons, BATCH_SIZE)) {
    const { error } = await client
      .from("coupons")
      .upsert(batch, { onConflict: "external_id" });
    if (error) throw new Error(`coupons upsert failed: ${error.message}`);
    written += batch.length;
    process.stdout.write(`\r   coupons upserted: ${written}/${coupons.length}`);
  }
  console.log(`\n   coupons upserted: ${written}`);
  return written;
}

async function deactivateStale(
  client: ServiceClient,
  approvedCampaignIds: Set<string>,
  approvedStoreIds: Set<string>,
): Promise<{ stores: number; coupons: number }> {
  let deactivatedStores = 0;
  const { data: stores, error: storeError } = await client
    .from("stores")
    .select("id, slug, admitted_campaign_id, is_active")
    .eq("admitted_network", "admitad");
  if (storeError) throw new Error(`stores scan failed: ${storeError.message}`);

  const staleStoreIds = ((stores ?? []) as Array<{
    id: string;
    admitted_campaign_id: string | null;
    is_active: boolean;
  }>)
    .filter(
      (store) =>
        store.is_active &&
        (!store.admitted_campaign_id || !approvedCampaignIds.has(store.admitted_campaign_id)),
    )
    .map((store) => store.id);

  for (const batch of chunks(staleStoreIds, BATCH_SIZE)) {
    const { error } = await client.from("stores").update({ is_active: false }).in("id", batch);
    if (error) throw new Error(`stores deactivate failed: ${error.message}`);
    deactivatedStores += batch.length;
  }

  let deactivatedCoupons = 0;
  const { data: coupons, error: couponError } = await client
    .from("coupons")
    .select("id, store_id, external_id, is_active")
    .eq("is_active", true);
  if (couponError) throw new Error(`coupons scan failed: ${couponError.message}`);

  const staleCouponIds = ((coupons ?? []) as Array<{
    id: string;
    store_id: string | null;
    external_id: string | null;
    is_active: boolean;
  }>)
    .filter(
      (coupon) =>
        coupon.is_active &&
        (!coupon.external_id || !coupon.store_id || !approvedStoreIds.has(coupon.store_id)),
    )
    .map((coupon) => coupon.id);

  for (const batch of chunks(staleCouponIds, BATCH_SIZE)) {
    const { error } = await client
      .from("coupons")
      .update({ is_active: false, verified: false })
      .in("id", batch);
    if (error) throw new Error(`coupons deactivate failed: ${error.message}`);
    deactivatedCoupons += batch.length;
  }

  return { stores: deactivatedStores, coupons: deactivatedCoupons };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  loadEnvLocal();

  console.log("Admitad approved-network ingestion");
  console.log(`   mode: ${DRY_RUN ? "DRY RUN (no writes)" : "LIVE"}`);
  console.log(`   batch size: ${BATCH_SIZE}`);

  const programRows = readPrograms();
  const couponRows = readCoupons();
  const programs = buildApprovedPrograms(programRows);
  if (programs.length === 0) throw new Error("No approved programs found in master sheet");

  const programRowById = new Map<string, ProgramRow>();
  for (const row of programRows) {
    const id = cleanText(row.id);
    if (id) programRowById.set(id, row);
  }

  const couponsByCampaign = new Map<string, CouponRow[]>();
  for (const coupon of couponRows) {
    const id = cleanText(coupon.advcampaign_id);
    const list = couponsByCampaign.get(id) ?? [];
    list.push(coupon);
    couponsByCampaign.set(id, list);
  }

  const stores = buildStores(programs, programRowById, couponsByCampaign);
  console.log(`   approved merchants: ${programs.length}`);
  console.log(`   coupon feed rows: ${couponRows.length}`);

  const approvedCampaignIds = new Set(programs.map((program) => program.campaignId));
  const approvedStoreIds = new Set(
    stores.map((store) => `store:${store.admitted_campaign_id}`),
  );

  let couponBuild = buildCoupons(programs, couponRows, new Set());
  console.log(`   coupons matched to approved merchants: ${couponBuild.rows.length}`);
  console.log(`   coupons skipped (unmatched merchant): ${couponBuild.unmatched}`);
  console.log(`   coupons skipped (missing id/title): ${couponBuild.skipped}`);

  if (DRY_RUN) {
    const byStore = new Map<string, number>();
    for (const coupon of couponBuild.rows) {
      byStore.set(coupon.campaign_id, (byStore.get(coupon.campaign_id) ?? 0) + 1);
    }
    console.log("\n   top merchants by coupon count:");
    [...byStore.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([campaignId, count]) => {
        const program = programs.find((item) => item.campaignId === campaignId);
        console.log(`     ${program?.name ?? campaignId}: ${count}`);
      });
    console.log("\n   DRY RUN complete — no database writes performed.");
  } else {
    const client = getClient();
    const allowedCountries = await loadAllowedCountries(client);
    couponBuild = buildCoupons(programs, couponRows, allowedCountries);

    const storeIds = await upsertStores(client, stores);
    for (const coupon of couponBuild.rows) {
      coupon.store_id = storeIds.get(coupon.campaign_id) ?? "";
    }
    const linkable = couponBuild.rows.filter((coupon) => coupon.store_id);
    const unlinked = couponBuild.rows.length - linkable.length;
    if (unlinked > 0) {
      console.warn(`   coupons without a resolved store id: ${unlinked}`);
    }

    await upsertCoupons(client, linkable);

    const approvedStoreIdsReal = new Set(
      stores
        .map((store) => storeIds.get(store.admitted_campaign_id))
        .filter((id): id is string => Boolean(id)),
    );
    // Keep the placeholder set meaningful only for the dry-run path.
    approvedStoreIds.clear();
    for (const id of approvedStoreIdsReal) approvedStoreIds.add(id);

    const deactivated = await deactivateStale(
      client,
      approvedCampaignIds,
      approvedStoreIds,
    );
    console.log(
      `   deactivated stale rows: ${deactivated.stores} stores, ${deactivated.coupons} coupons`,
    );
  }

  const couponStoreCount = new Set(
    couponBuild.rows.map((coupon) => coupon.campaign_id),
  ).size;
  const manifest: Manifest = {
    generatedAt: new Date().toISOString(),
    sourceFiles: {
      programs: "master_programms.xlsx",
      coupons: "coupons_feed.csv",
    },
    programCount: programs.length,
    couponCount: couponBuild.rows.length,
    couponStoreCount,
    programs: programs.map((program) => ({
      id: program.campaignId,
      name: program.name,
      slug: program.slug,
      siteUrl: program.siteUrl,
      logoUrl:
        couponsByCampaign
          .get(program.campaignId)
          ?.map((coupon) => cleanText(coupon.logo))
          .find(Boolean) ?? null,
    })),
  };
  writeFileSync(MANIFEST_FILE, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log(`   manifest written: ${MANIFEST_FILE}`);

  console.log("\nDone.");
}

main().catch((error) => {
  console.error("\nIngestion failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

