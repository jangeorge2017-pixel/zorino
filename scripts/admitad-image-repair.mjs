#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const discoverOnly = args.includes("--test");
const limit = readNumericArg("limit", 0);
const concurrency = readNumericArg("concurrency", 48) || 48;

function readNumericArg(name, fallback) {
  const exact = args.find((arg) => arg.startsWith(`--${name}=`));
  if (exact) {
    const value = Number(exact.slice(name.length + 3));
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
  const index = args.indexOf(`--${name}`);
  if (index >= 0 && args[index + 1]) {
    const value = Number(args[index + 1]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  }
  return fallback;
}

const envPath = resolve(process.cwd(), ".env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    const commentIndex = value.search(/\s+#/);
    if (commentIndex >= 0) value = value.slice(0, commentIndex).trim();
    while (
      value.length > 1 &&
      (value.startsWith('"') || value.startsWith("'")) &&
      (value.endsWith('"') || value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

const API_BASE = "https://api.admitad.com";
const TOKEN_URL = `${API_BASE}/token/`;
const STORE_NAME = "Alibaba WW";
const RATE_LIMIT = 90;
const RATE_WINDOW = 60_000;
const BATCH_SIZE = 200;

let tokenCache = null;
let requestTimestamps = [];

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function decodeXml(text) {
  return String(text ?? "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function unwrapCdata(value) {
  const text = decodeXml(value).trim();
  const cdata = text.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (cdata ? cdata[1] : text).trim();
}

function normalizeHttpUrl(value) {
  let url = unwrapCdata(value).replace(/\\+\//g, "/").replace(/\s+/g, "");
  if (url.startsWith("//")) url = `https:${url}`;
  if (/^http:\/\//i.test(url)) url = `https://${url.slice(7)}`;
  if (!/^https:\/\//i.test(url)) return "";
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || /\.svg($|\?)/i.test(parsed.pathname)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
}

function normalizeTitle(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function productIdFromUrl(value) {
  try {
    const current = new URL(normalizeHttpUrl(value));
    const direct = current.searchParams.get("productId");
    if (direct && /^\d+$/.test(direct)) return direct;
    for (const key of ["ulp", "url", "target", "destination", "redirect"]) {
      const nested = current.searchParams.get(key);
      if (!nested) continue;
      const decoded = decodeURIComponent(nested);
      const match = decoded.match(/productId=(\d+)/i);
      if (match) return match[1];
    }
  } catch {}
  const match = String(value ?? "").match(/productId(?:%3D|=)(\d+)/i);
  return match?.[1] ?? "";
}

function extractRawTags(xml, tag) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const values = [];
  let match;
  while ((match = pattern.exec(xml)) !== null) values.push(match[1].trim());
  return values;
}

function extractTag(xml, tag) {
  return extractRawTags(xml, `g:${tag}`)[0] ?? extractRawTags(xml, tag)[0] ?? "";
}

function imageCandidates(xml, description) {
  const candidates = [
    ...extractRawTags(xml, "g:image_link"),
    ...extractRawTags(xml, "image_link"),
    ...extractRawTags(xml, "image"),
    ...extractRawTags(xml, "picture"),
    ...extractRawTags(xml, "photo"),
    ...extractRawTags(xml, "g:additional_image_link").flatMap((value) => value.split(/\s+/)),
  ];
  for (const imageMatch of description.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    candidates.push(imageMatch[1]);
  }
  const urls = [];
  for (const candidate of candidates) {
    const url = normalizeHttpUrl(candidate);
    if (url && !urls.includes(url)) urls.push(url);
  }
  return urls;
}

function parseOffer(xml) {
  const isLegacy = /<offer\s+id="\d+"/i.test(xml);
  const id = isLegacy
    ? xml.match(/<offer\s+id="(\d+)"/i)?.[1] ?? ""
    : extractTag(xml, "id");
  const name = decodeXml(isLegacy ? extractTag(xml, "name") : extractTag(xml, "title"));
  const description = decodeXml(extractTag(xml, "description"));
  const url = normalizeHttpUrl(isLegacy ? extractTag(xml, "url") : extractTag(xml, "link"));
  const images = imageCandidates(xml, description);
  if (!id || !name || images.length === 0) return null;
  return {
    id,
    name,
    url,
    images,
    productId: productIdFromUrl(url) || (/^\d+$/.test(id) ? id : ""),
  };
}

async function throttle() {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_WINDOW) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= RATE_LIMIT) {
    const wait = requestTimestamps[0] + RATE_WINDOW - now + 100;
    if (wait > 0) await new Promise((done) => setTimeout(done, wait));
  }
  requestTimestamps.push(Date.now());
}

async function accessToken() {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.value;
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: requireEnv("ADMITAD_CLIENT_ID"),
    client_secret: requireEnv("ADMITAD_CLIENT_SECRET"),
    scope: "advcampaigns advcampaigns_for_website websites deeplink_generator",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Token HTTP ${response.status}`);
  const data = await response.json();
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + (Number(data.expires_in) - 60) * 1000,
  };
  return tokenCache.value;
}

async function apiGet(path, params = {}) {
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await new Promise((done) => setTimeout(done, Math.min(2_000 * 2 ** (attempt - 1), 10_000)));
    await throttle();
    const url = new URL(path, API_BASE);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${await accessToken()}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 401) {
      tokenCache = null;
      continue;
    }
    if (response.status === 429) {
      const retry = Number(response.headers.get("Retry-After") ?? "5") || 5;
      await new Promise((done) => setTimeout(done, retry * 1000));
      continue;
    }
    if (!response.ok) throw new Error(`API ${response.status} on ${path}`);
    return response.json();
  }
  throw new Error(`API failed after retries: ${path}`);
}

async function listAllPages(path) {
  const all = [];
  let offset = 0;
  for (;;) {
    const data = await apiGet(path, { offset: String(offset), limit: "100" });
    all.push(...data.results);
    if (all.length >= data._meta.count || data.results.length === 0) break;
    offset += 100;
  }
  return all;
}

async function discoverAlibabaFeeds() {
  const websites = await listAllPages("/websites/");
  const feeds = [];
  const seenUrls = new Set();
  for (const website of websites) {
    let campaigns = [];
    try {
      campaigns = await listAllPages(`/advcampaigns/website/${website.id}/`);
    } catch (error) {
      console.warn(`   website ${website.id} campaigns failed: ${error.message}`);
      continue;
    }
    const alibaba = campaigns.filter(
      (campaign) =>
        /alibaba/i.test(String(campaign?.name ?? "")) &&
        campaign?.connection_status === "active" &&
        (campaign?.status === "active" || !campaign?.status),
    );
    alibaba.sort((a, b) => {
      const exactA = String(a.name).trim().toLowerCase() === STORE_NAME.toLowerCase() ? 0 : 1;
      const exactB = String(b.name).trim().toLowerCase() === STORE_NAME.toLowerCase() ? 0 : 1;
      return exactA - exactB;
    });
    for (const campaign of alibaba) {
      for (const feed of campaign.feeds_info ?? []) {
        const feedUrl = normalizeHttpUrl(feed?.xml_link);
        if (!feedUrl || seenUrls.has(feedUrl)) continue;
        seenUrls.add(feedUrl);
        feeds.push({ campaign, feedUrl, feedName: feed.name || "unknown" });
      }
    }
  }
  return feeds;
}

async function fetchFeed(feedUrl) {
  const response = await fetch(feedUrl, {
    headers: { "User-Agent": "ZorinoBot/2.0-alibaba-image-repair" },
    signal: AbortSignal.timeout(180_000),
  });
  if (!response.ok) throw new Error(`Feed HTTP ${response.status}`);
  if (!response.body) throw new Error("Feed body is null");
  const offers = new Map();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const consume = () => {
    const regex = /<(?:offer\s+id="\d+"[^>]*|entry)>[\s\S]*?<\/(?:offer|entry)>/gi;
    let match;
    while ((match = regex.exec(buffer)) !== null) {
      const offer = parseOffer(match[0]);
      if (!offer) continue;
      const existing = offers.get(offer.id);
      if (!existing) {
        offers.set(offer.id, offer);
      } else {
        for (const image of offer.images) {
          if (!existing.images.includes(image)) existing.images.push(image);
        }
      }
    }
    const last = Math.max(buffer.lastIndexOf("<offer"), buffer.lastIndexOf("<entry"));
    buffer = last > 0 ? buffer.slice(last) : "";
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      consume();
    }
    consume();
  } finally {
    try {
      await reader.cancel();
    } catch {}
  }
  return Array.from(offers.values());
}

function getDb() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase URL or service role key");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getConfiguredFeed(db) {
  const feedUrl = normalizeHttpUrl(process.env.ADMITAD_FEED_URL);
  if (!feedUrl) return null;
  const store = await db
    .from("stores")
    .select("slug")
    .eq("name", STORE_NAME)
    .limit(1);
  const campaignId = store.data?.[0]?.slug?.match(/(\d+)$/)?.[1] ?? "";
  if (!campaignId) return null;
  return {
    campaign: { id: campaignId, name: STORE_NAME },
    feedUrl,
    feedName: "configured-feed",
  };
}

async function loadRows(db) {
  const rows = [];
  let lastId = null;
  for (;;) {
    let query = db
      .from("lowest_prices_today")
      .select("id,product_id,product_slug,product_name,image_url,external_url")
      .eq("store_name", STORE_NAME)
      .eq("provider", "admitad")
      .order("id", { ascending: true })
      .limit(1_000);
    if (lastId) query = query.gt("id", lastId);
    const result = await query;
    if (result.error) throw new Error(result.error.message);
    if (!result.data?.length) break;
    rows.push(...result.data);
    lastId = result.data[result.data.length - 1].id;
    if (limit > 0 && rows.length >= limit) break;
  }
  return limit > 0 ? rows.slice(0, limit) : rows;
}

function imageVariants(url) {
  const variants = [url];
  const highRes = url.replace(/_\d+x\d+(?=\.[a-z0-9]+$)/i, "_1200x1200");
  if (highRes !== url) variants.push(highRes);
  const unsized = url.replace(/_\d+x\d+(?=\.[a-z0-9]+$)/i, "");
  if (unsized !== url && !variants.includes(unsized)) variants.push(unsized);
  return variants;
}

function buildOfferMaps(offers, campaignId) {
  const bySlug = new Map();
  const byOfferId = new Map();
  const byProductId = new Map();
  const byTitle = new Map();
  for (const offer of offers) {
    bySlug.set(`admitad-${campaignId}-${offer.id}`, offer);
    byOfferId.set(offer.id, offer);
    if (offer.productId) byProductId.set(offer.productId, offer);
    const titleKey = normalizeTitle(offer.name);
    if (!titleKey) continue;
    if (!byTitle.has(titleKey)) byTitle.set(titleKey, []);
    byTitle.get(titleKey).push(offer);
  }
  return { bySlug, byOfferId, byProductId, byTitle };
}

function matchOffer(row, maps) {
  if (maps.bySlug.has(row.product_slug)) return maps.bySlug.get(row.product_slug);
  const slugId = String(row.product_slug ?? "").split("-").pop() ?? "";
  if (maps.byOfferId.has(slugId)) return maps.byOfferId.get(slugId);
  const urlId = productIdFromUrl(row.external_url);
  if (urlId && maps.byProductId.has(urlId)) return maps.byProductId.get(urlId);
  if (urlId && maps.byOfferId.has(urlId)) return maps.byOfferId.get(urlId);
  const titles = maps.byTitle.get(normalizeTitle(row.product_name)) ?? [];
  return titles.length === 1 ? titles[0] : null;
}

function baseCandidates(row, offer) {
  const urls = [];
  const add = (url) => {
    const normalized = normalizeHttpUrl(url);
    if (normalized && !urls.includes(normalized)) urls.push(normalized);
  };
  for (const image of (offer?.images ?? []).slice(0, 2)) add(image);
  add(row.image_url);
  return urls;
}

function variantCandidates(baseUrls) {
  const urls = [];
  for (const url of baseUrls) {
    for (const variant of imageVariants(url)) {
      if (!urls.includes(variant)) urls.push(variant);
    }
  }
  return urls;
}

async function mapWithConcurrency(items, worker) {
  const results = new Array(items.length);
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      for (;;) {
        const current = index++;
        if (current >= items.length) return;
        results[current] = await worker(items[current], current);
      }
    }),
  );
  return results;
}

function hasImageSignature(bytes) {
  if (bytes.length < 12) return false;
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true;
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true;
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return true;
  }
  return false;
}

async function singleImageProbe(url) {
  try {
    const response = await fetch(url, {
      headers: { Range: "bytes=0-1023" },
      signal: AbortSignal.timeout(8_000),
    });
    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    if (!(response.ok || response.status === 206) || !contentType.startsWith("image/")) {
      try {
        await response.body?.cancel();
      } catch {}
      return false;
    }
    const reader = response.body?.getReader();
    if (!reader) return false;
    const { value } = await reader.read();
    try {
      await reader.cancel();
    } catch {}
    return hasImageSignature(new Uint8Array(value ?? []));
  } catch {
    return false;
  }
}

async function imageResponds(url) {
  let successes = 0;
  let failures = 0;
  while (successes < 2 && failures < 2) {
    if (await singleImageProbe(url)) successes++;
    else failures++;
  }
  return successes >= 2;
}

async function batched(items, size, worker) {
  for (let index = 0; index < items.length; index += size) {
    await worker(items.slice(index, index + size));
  }
}

async function main() {
  console.log("Alibaba image repair");
  console.log(`mode: ${dryRun ? "dry-run" : "write"}`);
  console.log(`rows: ${limit > 0 ? limit : "all"}`);
  console.log(`concurrency: ${concurrency}`);

  const db = getDb();

  console.log("1. Discovering Alibaba feeds...");
  let feeds = [];
  try {
    feeds = await discoverAlibabaFeeds();
  } catch (error) {
    console.warn(`   API discovery unavailable: ${error.message}`);
  }
  if (feeds.length === 0) {
    const configured = await getConfiguredFeed(db);
    if (configured) {
      feeds = [configured];
      console.log("   using configured one-off repair feed");
    } else {
      console.log("   no feed available; will probe stored provider image URLs");
    }
  }
  console.log(`   feeds: ${feeds.length}`);
  if (discoverOnly) return;

  const offers = [];
  if (feeds.length > 0) {
    console.log("2. Loading feed offers...");
    const offerIds = new Set();
    for (const feed of feeds) {
      const parsed = await fetchFeed(feed.feedUrl);
      for (const offer of parsed) {
        if (offerIds.has(offer.id)) continue;
        offerIds.add(offer.id);
        offers.push(offer);
      }
      console.log(`   ${feed.feedName}: ${parsed.length} offers`);
    }
    if (offers.length < 100) throw new Error(`Refusing repair: only ${offers.length} feed offers`);
  } else {
    console.log("2. Feed unavailable; using stored provider image URLs only");
  }
  const campaignId = feeds[0]?.campaign.id ?? "";
  const maps = buildOfferMaps(offers, campaignId);

  console.log("3. Loading stored rows...");
  const rows = await loadRows(db);
  console.log(`   rows: ${rows.length}`);
  if (rows.length === 0) return;

  const resolved = rows.map((row) => {
    const offer = matchOffer(row, maps);
    return {
      row,
      offer,
      base: baseCandidates(row, offer),
      replacement: "",
      match: offer ? (maps.bySlug.get(`admitad-${campaignId}-${offer.id}`) === offer ? "slug" : "fallback") : "none",
    };
  });

  console.log("4. Probing stored image URLs...");
  const baseUrls = [...new Set(resolved.flatMap((entry) => entry.base))];
  const baseResults = await mapWithConcurrency(baseUrls, imageResponds);
  const validBase = new Set();
  for (let index = 0; index < baseUrls.length; index++) {
    if (baseResults[index]) validBase.add(baseUrls[index]);
  }
  console.log(`   unique URLs: ${baseUrls.length}, valid: ${validBase.size}`);

  const unresolved = [];
  for (const entry of resolved) {
    entry.replacement = entry.base.find((url) => validBase.has(url)) ?? "";
    if (!entry.replacement) unresolved.push(entry);
  }

  if (unresolved.length > 0) {
    console.log("5. Probing size variants for unresolved rows...");
    const variantUrls = [...new Set(unresolved.flatMap((entry) => variantCandidates(entry.base)))];
    const variantResults = await mapWithConcurrency(variantUrls, imageResponds);
    const validVariants = new Set();
    for (let index = 0; index < variantUrls.length; index++) {
      if (variantResults[index]) validVariants.add(variantUrls[index]);
    }
    console.log(`   unique URLs: ${variantUrls.length}, valid: ${validVariants.size}`);
    for (const entry of unresolved) {
      entry.replacement = variantCandidates(entry.base).find((url) => validVariants.has(url)) ?? "";
    }
  }

  const repairs = [];
  const deletions = [];
  for (const entry of resolved) {
    if (entry.replacement) {
      repairs.push({ id: entry.row.id, productId: entry.row.product_id, imageUrl: entry.replacement });
    } else {
      deletions.push(entry.row.id);
    }
  }
  const changed = repairs.filter((repair) => {
    const row = resolved.find((entry) => entry.row.id === repair.id)?.row;
    return row && row.image_url !== repair.imageUrl;
  });
  console.log(`   matched by slug: ${resolved.filter((entry) => entry.match === "slug").length}`);
  console.log(`   matched by fallback: ${resolved.filter((entry) => entry.match === "fallback").length}`);
  console.log(`   unmatched: ${resolved.filter((entry) => entry.match === "none").length}`);
  console.log(`   replacements: ${changed.length}`);
  console.log(`   delete candidates: ${deletions.length}`);

  if (dryRun) {
    console.log("   dry-run: no writes performed");
    console.log(JSON.stringify(changed.slice(0, 3), null, 2));
    return;
  }

  console.log("5. Writing repairs...");
  const idsByImage = new Map();
  for (const repair of changed) {
    const ids = idsByImage.get(repair.imageUrl) ?? [];
    ids.push(repair.id);
    idsByImage.set(repair.imageUrl, ids);
  }
  for (const [imageUrl, ids] of idsByImage) {
    await batched(ids, BATCH_SIZE, async (idBatch) => {
      const result = await db
        .from("lowest_prices_today")
        .update({ image_url: imageUrl })
        .in("id", idBatch);
      if (result.error) throw new Error(result.error.message);
    });
  }
  const productIdsByImage = new Map();
  for (const repair of changed) {
    if (!repair.productId) continue;
    const ids = productIdsByImage.get(repair.imageUrl) ?? [];
    if (!ids.includes(repair.productId)) ids.push(repair.productId);
    productIdsByImage.set(repair.imageUrl, ids);
  }
  for (const [imageUrl, productIds] of productIdsByImage) {
    await batched(productIds, BATCH_SIZE, async (idBatch) => {
      const result = await db
        .from("products")
        .update({ main_image: imageUrl })
        .in("id", idBatch);
      if (result.error) throw new Error(result.error.message);
    });
  }

  console.log("6. Deleting unrecoverable rows...");
  await batched(deletions, BATCH_SIZE, async (batch) => {
    const result = await db.from("lowest_prices_today").delete().in("id", batch);
    if (result.error) throw new Error(result.error.message);
  });

  console.log(`done. repaired=${changed.length} deleted=${deletions.length}`);
}

main().catch((error) => {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
