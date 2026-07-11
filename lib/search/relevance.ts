/**
 * Marketplace-agnostic search relevance for device/product queries.
 * Used by AliExpress, eBay, and future provider integrations.
 *
 * Phase 3 engine: score-and-rank (not hard-drop), device-first tiers,
 * graduated accessory backfill when too few real products are found.
 */

/** Accessory terms — longer phrases listed first for substring checks. */
export const ACCESSORY_TERMS = [
  "screen protector",
  "tempered glass",
  "phone case",
  "phone cover",
  "phone holder",
  "phone mount",
  "car phone mount",
  "car mount",
  "car charger",
  "wireless charger",
  "charging dock",
  "charging cable",
  "charging case",
  "usb cable",
  "camera lens",
  "replacement part",
  "replacement screen",
  "leather case",
  "soft case",
  "hard case",
  "magnetic case",
  "silicone case",
  "swimming bag",
  "lavalier microphone",
  "lavalier mic",
  "wind muff",
  "magic keyboard",
  "keyboard",
  "sound card",
  "audio interface",
  "laminating machine",
  "laminating",
  "photo booth",
  "steering wheel",
  "organizer",
  "oca glass",
  "case",
  "cover",
  "charger",
  "cable",
  "protector",
  "tempered",
  "film",
  "sticker",
  "decal",
  "strap",
  "holder",
  "adapter",
  "stand",
  "mount",
  "skin",
  "shell",
  "pouch",
  "bag",
  "replacement",
  "silicone",
  "lens",
  "earphone",
  "earbud",
  "headphone",
  "microphone",
  "airbag",
  "gimbal",
  "tripod",
  "ring light",
  "sim tray",
  "sim card tool",
  "sticker ring",
  "magsafe ring",
  "magsafe sticker",
  "gamepad",
  "game controller",
  "telescopic",
  "thermal paste",
  "thermal grease",
  "thermal pad",
  "paste grease",
  "vacuum cleaner head",
  "clip latch",
  "latch tab",
  "backpack",
  "laptop stand",
  "laptop holder",
  "laptop bag",
  "cleaning pen",
  "charging port",
  "charging dock",
  "dock for",
  "capture card",
  "video capture",
  "hepa filter",
  "roller brush",
  "brush head",
  "filter roller",
  "laptop battery",
  "battery for",
  "cooling fan",
  "usb cooling",
  "aerial mast",
  "mast pole",
  "tpms",
  "tire pressure",
] as const;

/** Repair tools and spare parts — always excluded on device-model searches. */
export const REPAIR_AND_PARTS_TERMS = [
  "screen separator",
  "lcd separator",
  "separator machine",
  "vacuum separator",
  "repair tool",
  "opening tool",
  "pry tool",
  "spudger",
  "suction cup",
  "flex cable",
  "digitizer",
  "display assembly",
  "lcd display",
  "touch screen replacement",
  "back cover glass",
  "housing frame",
  "middle frame",
  "bezel frame",
  "oca machine",
  "refurbish tool",
  "battery replacement",
  "replacement battery",
  "mobile phone battery",
  "phone battery",
  "mah battery",
  "mah eb-",
  " eb-b",
  "long lasting",
  "soldering station",
  "heat gun",
  "screen removal",
  "phone repair",
  "repair kit",
  "parts only",
  "for parts",
  "broken screen",
  "dc jack",
  "usb-c connector",
  "power jack",
  "type-c connector",
  "touch id sensor",
  "keycap",
  "key cap",
  "reballing",
  "bga stencil",
  "nand flash",
  "motherboard",
  "lcd panel",
  "screen panel",
  "ssd chip",
  "ssd for",
  "ssfor",
  "speaker for",
  "magsafe connector",
  "usb hub",
  "carte logique",
  "logic board",
  "logicboard",
  "main board",
  "mainboard",
  "i/o board",
  " i/o ",
  "mlb for",
  "mother ",
  " mother",
  "thermal paste",
  "thermal grease",
  "thermal conductivity",
  "paste grease",
  "conductivity paste",
  "clip latch",
  "latch tab",
  "head clip",
  "display only",
  "oem genuine part",
  "genuine part",
  "damaged flex",
  "flex shaft",
  "part damaged",
  "for parts or repair",
  "laptop battery",
  "battery for",
  "cooling fan",
] as const;

/** Accessory-only product types excluded on device-model searches. */
export const DEVICE_ACCESSORY_TYPES = [
  "stylus",
  " s pen",
  "touch pen",
  "electromagnetic pen",
  "fold edition stylus",
  "pen for",
  "pencil for",
  "stylus pen",
] as const;

/** Official device brands to prioritize / require on model-specific searches. */
export const OFFICIAL_DEVICE_BRANDS = [
  "apple",
  "samsung",
  "xiaomi",
  "redmi",
  "poco",
  "google",
  "pixel",
  "oneplus",
  "one plus",
  "sony",
  "playstation",
  "huawei",
  "honor",
  "oppo",
  "vivo",
  "realme",
  "motorola",
  "nokia",
  "nvidia",
  "geforce",
] as const;

/** Category names that strongly suggest a primary device listing. */
export const DEVICE_CATEGORY_HINTS = [
  "phones",
  "telecommunication",
  "tablet",
  "computer",
  "laptop",
  "notebook",
  "video game",
  "console",
  "games",
] as const;

export const MARKETPLACE_SEARCH_DEFAULTS = {
  /** AliExpress affiliate API max page_size; eBay Browse max is also 50. */
  PAGE_SIZE: 50,
  /** Scan API pages until MIN_FETCH_COUNT or catalog exhaustion. */
  MAX_PAGES: 12,
  /** Keep paging until at least this many unique listings are collected. */
  MIN_FETCH_COUNT: 100,
  /** Target ranking pool size. */
  TARGET_FETCH_COUNT: 300,
  /** Hide accessories when at least this many real devices are ranked. */
  MIN_DEVICES_BEFORE_HIDING_ACCESSORIES: 6,
  /** Default search results shown on the first page. */
  DEFAULT_LIMIT: 24,
} as const;

/** Match tier used for smart ranking (highest tier wins). */
export type ProductMatchTier =
  | "exact"
  | "model"
  | "series"
  | "brand"
  | "accessory"
  | "repair"
  | "none";

export interface SearchListingAnalysis {
  tier: ProductMatchTier;
  score: number;
  isDevice: boolean;
}

const TIER_BASE_SCORE: Record<ProductMatchTier, number> = {
  exact: 1000,
  model: 800,
  series: 600,
  brand: 400,
  accessory: 120,
  repair: -1,
  none: 0,
};

/** Significant tokens from the user query (lowercased). */
export function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s.+-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

/** True when the user query explicitly asks for an accessory. */
export function queryWantsAccessory(query: string): boolean {
  const phrase = query.trim().toLowerCase();
  return (
    ACCESSORY_TERMS.some((term) => phrase.includes(term)) ||
    REPAIR_AND_PARTS_TERMS.some((term) => phrase.includes(term))
  );
}

function isRepairOrPartsListing(hay: string): boolean {
  if (REPAIR_AND_PARTS_TERMS.some((term) => hay.includes(term))) return true;
  // Replacement batteries sold by mAh / Samsung part codes.
  if (/\b\d{3,5}\s*mah\b/i.test(hay)) return true;
  if (/\beb-[a-z0-9]{5,}\b/i.test(hay)) return true;
  // Apple logic-board part numbers and shorthand ("Map ... Mother 820-3209-A").
  if (/\b820[-\s]?\d{3,4}[-\sa-z0-9]*\b/i.test(hay)) return true;
  if (/\bmap\b[^,.]{0,40}\b(a1\d{3}|mother|820)\b/i.test(hay)) return true;
  if (/\b(a1\d{3})\b/i.test(hay) && /\b(mother|board|820|logic|mainboard)\b/i.test(hay)) {
    return true;
  }
  return false;
}

function looksLikeMacBookLaptop(hay: string, category?: string): boolean {
  if (!/\bmacbook\s+(air|pro)\b/.test(hay) && !/^apple\s+macbook/i.test(hay.trim())) {
    return false;
  }
  if (
    /\b(for\s+macbook|pour\s+macbook|replacement|panel|mother|magsafe|ssd|connector|jack|keycap|chip|stencil|genuine\s+for|genuine\s+oem|820-|logic\s*board|main\s*board|map\b|display\s+only|oem\s+genuine\s+part|flex\s+shaft|damaged)\b/.test(
      hay
    )
  ) {
    return false;
  }
  if (/\b(m1|m2|m3|m4|\d+\s*(gb|tb))\b/i.test(hay)) return true;
  return categorySuggestsDevice(category);
}

/** Brand names required in title for model-specific device queries. */
export function requiredBrandsForQuery(query: string): string[] | null {
  const q = query.trim().toLowerCase();

  if (/\b(iphone|ipad|macbook)\b/.test(q)) {
    return ["apple", "iphone", "ipad", "macbook"];
  }
  if (/\b(galaxy|samsung|fold)\b/.test(q)) {
    return ["samsung"];
  }
  if (/\b(xiaomi|redmi|poco)\b/.test(q)) {
    return ["xiaomi", "redmi", "poco"];
  }
  if (/\b(pixel|google)\b/.test(q)) {
    return ["google", "pixel"];
  }
  if (/\b(oneplus|one plus)\b/.test(q)) {
    return ["oneplus", "one plus"];
  }
  if (/\b(ps5|playstation)\b/.test(q)) {
    return ["sony", "playstation", "ps5"];
  }
  if (/\brtx\b/.test(q)) {
    return ["nvidia", "geforce", "rtx"];
  }

  return null;
}

function brandMatchesQuery(hay: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (/\biphone\b/.test(q) && /\b(iphone|apple)\b/.test(hay)) return true;
  if (/\b(galaxy|samsung|fold)\b/.test(q) && /\b(samsung|galaxy)\b/.test(hay)) return true;
  if (/\bmacbook\b/.test(q) && /\b(macbook|apple)\b/.test(hay)) return true;
  if (/\b(ps5|playstation)\b/.test(q) && /\b(ps5|playstation|sony)\b/.test(hay)) return true;
  if (/\brtx\b/.test(q) && /\b(rtx|geforce|nvidia)\b/.test(hay)) return true;
  return OFFICIAL_DEVICE_BRANDS.some((brand) => q.includes(brand) && hay.includes(brand));
}

function queryOverlapScore(title: string, query: string): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return 0;

  const hay = title.toLowerCase();
  if (titleMatchesQuery(title, query)) return 100;

  let matched = 0;
  for (const token of tokens) {
    if (hay.includes(token)) matched++;
  }
  if (matched === 0) {
    return brandMatchesQuery(hay, query) ? 35 : 0;
  }

  return Math.round((matched / tokens.length) * 70);
}

function extractIphoneGeneration(hay: string): string | null {
  const match = hay.match(/\biphone\s*(\d{1,2})\b/i);
  return match ? match[1] : null;
}

function extractGalaxySModel(hay: string): string | null {
  const match = hay.match(/\b(?:galaxy\s*)?s(\d{1,2})\b/i);
  return match ? match[1] : null;
}

function extractRtxModel(hay: string): string | null {
  const match = hay.match(/\brtx\s*(\d{4})\b/i);
  return match ? match[1] : null;
}

/** Same model identifier (e.g. iPhone 15, S24, RTX 5090). */
export function hasSameModel(title: string, query: string): boolean {
  const q = query.toLowerCase();
  const hay = title.toLowerCase();

  const qIphone = extractIphoneGeneration(q);
  const tIphone = extractIphoneGeneration(hay);
  if (qIphone && tIphone) return qIphone === tIphone;

  const qS = q.match(/\bs(\d{1,2})\b/);
  const tS = extractGalaxySModel(hay);
  if (qS && tS) return qS[1] === tS;

  const qFold = q.match(/\bfold\s*(\d)?/);
  const tFold = hay.match(/\b(?:z\s*)?fold\s*(\d)?/);
  if (qFold && tFold) return (qFold[1] ?? "") === (tFold[1] ?? "");

  const qRtx = extractRtxModel(q);
  const tRtx = extractRtxModel(hay);
  if (qRtx && tRtx) return qRtx === tRtx;

  if (/\bps5\b/.test(q) && /\bps5\b/.test(hay)) return true;

  return titleMatchesQuery(title, query);
}

/** Same product family / series (e.g. any iPhone, Galaxy S line, MacBook). */
export function hasSameSeries(title: string, query: string): boolean {
  const q = query.toLowerCase();
  const hay = title.toLowerCase();

  if (/\biphone\b/.test(q) && /\biphone\b/.test(hay)) return true;
  if (/\b(galaxy|samsung|fold|flip)\b/.test(q) && /\b(galaxy|samsung|fold|flip)\b/.test(hay)) {
    return true;
  }
  if (/\bmacbook\b/.test(q) && /\bmacbook\b/.test(hay)) return true;
  if (/\b(ps5|playstation)\b/.test(q) && /\b(ps5|playstation)\b/.test(hay)) return true;
  if (/\brtx\b/.test(q) && /\brtx\b/.test(hay)) return true;
  if (/\bipad\b/.test(q) && /\bipad\b/.test(hay)) return true;
  if (/\bswitch\b/.test(q) && /\b(switch|nintendo)\b/.test(hay)) return true;
  if (/\b(laptop|notebook)\b/.test(q) && /\b(laptop|notebook|macbook)\b/.test(hay)) return true;

  return false;
}

export function hasOfficialBrand(title: string, query: string): boolean {
  const hay = title.toLowerCase();
  const required = requiredBrandsForQuery(query);
  if (required) {
    if (required.some((brand) => hay.includes(brand))) return true;
    // PS5 listings often lead with "PlayStation 5" without "Sony".
    if (/\b(ps5|playstation)\b/.test(query.toLowerCase()) && /\b(ps5|playstation\s*5)\b/.test(hay)) {
      return true;
    }
    return false;
  }
  return OFFICIAL_DEVICE_BRANDS.some((brand) => hay.includes(brand));
}

/** True when all query tokens appear in the title, with device-family shorthand. */
export function titleMatchesQuery(title: string, query: string): boolean {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return false;

  const hay = title.toLowerCase();
  if (tokens.every((token) => hay.includes(token))) return true;

  // "galaxy a55" / "galaxy s24" / "galaxy fold" — titles often omit "Galaxy".
  if (tokens.includes("galaxy")) {
    const modelTokens = tokens.filter((t) => t !== "galaxy");
    if (
      modelTokens.length > 0 &&
      /\bsamsung\b/.test(hay) &&
      modelTokens.every((t) => hay.includes(t))
    ) {
      return true;
    }
  }

  // "macbook air" — accept "Apple MacBook Air M2".
  if (tokens.includes("macbook") && tokens.includes("air") && /\bmacbook\b/.test(hay) && /\bair\b/.test(hay)) {
    return true;
  }

  // "ps5" — accept "PlayStation 5" / "PS5 Console".
  if (tokens.length === 1 && tokens[0] === "ps5") {
    return /\b(ps5|playstation\s*5)\b/.test(hay);
  }

  // "rtx 5090" — accept "NVIDIA GeForce RTX 5090".
  if (tokens.includes("rtx")) {
    const rtxTokens = tokens.filter((t) => t !== "rtx");
    if (rtxTokens.length > 0 && /\brtx\b/.test(hay) && rtxTokens.every((t) => hay.includes(t))) {
      return true;
    }
    if (tokens.length === 1 && tokens[0] === "rtx" && /\brtx\b/.test(hay)) return true;
  }

  // Brand-only queries: "Samsung", "iPhone", "MacBook".
  if (tokens.length === 1) {
    const token = tokens[0];
    if (["iphone", "samsung", "macbook", "ipad", "xiaomi", "ps5", "playstation"].includes(token)) {
      return hay.includes(token) || (token === "samsung" && /\bgalaxy\b/.test(hay));
    }
  }

  return false;
}

function mentionsDeviceInForClause(hay: string): boolean {
  return (
    /\bfor\b[^,.]{0,80}\b(iphone|ipad|samsung|galaxy|xiaomi|redmi|macbook|ps5|playstation)\b/.test(
      hay
    ) ||
    /\bpour\b[^,.]{0,80}\b(iphone|ipad|samsung|galaxy|xiaomi|redmi|macbook|ps5|playstation)\b/.test(
      hay
    )
  );
}

function categorySuggestsDevice(category?: string): boolean {
  if (!category?.trim()) return false;
  const hay = category.toLowerCase();
  return DEVICE_CATEGORY_HINTS.some((hint) => hay.includes(hint));
}

function isAccessoryDominantTitle(hay: string): boolean {
  if (isRepairOrPartsListing(hay)) return true;

  // In-box extras on a device listing (e.g. "Includes Charging Cable") are not accessories.
  if (
    /\b\d+\s*(gb|tb)\b/.test(hay) &&
    /\b(includes|with)\b/.test(hay) &&
    /\b(cable|charger|adapter|controller)\b/.test(hay)
  ) {
    return false;
  }

  return ACCESSORY_TERMS.some((term) => hay.includes(term));
}

/**
 * Heuristic: listing looks like a primary device (phone/tablet/laptop/console),
 * not an accessory or repair part.
 */
export function looksLikeDevice(title: string, category?: string): boolean {
  const hay = title.toLowerCase();

  if (isRepairOrPartsListing(hay)) return false;

  // Storage/components sold as parts — not whole devices.
  if (
    /\b(ssd|nvme|hard drive|hdd|motherboard|keycap|dc jack|connector jack|reballing|stencil|nand flash)\b/.test(
      hay
    )
  ) {
    return false;
  }

  if (isAccessoryDominantTitle(hay)) {
    const hasStrongDeviceSignal =
      /\b\d+\s*(gb|tb)\b/i.test(title) &&
      (/\b(gsm\s+)?unlocked\b/.test(hay) ||
        /\bsmartphone\b/.test(hay) ||
        /\b5g\b/.test(hay) ||
        /\bdual\s+sim\b/.test(hay) ||
        categorySuggestsDevice(category));

    if (!hasStrongDeviceSignal) return false;
  }

  // Phones / tablets with storage
  if (/\b\d+\s*(gb|tb)\b/i.test(title)) {
    if (/\b(iphone|ipad|galaxy|xiaomi|redmi|pixel|oneplus)\b/.test(hay)) return true;
    if (looksLikeMacBookLaptop(hay, category)) return true;
    if (categorySuggestsDevice(category) && !/\b(for\s+macbook|pour\s+macbook|mother|820-|logic\s*board)\b/.test(hay)) {
      return true;
    }
    if (/\b(unlocked|smartphone|dual\s+sim|5g)\b/.test(hay)) return true;
  }

  if (/\b(gsm\s+)?unlocked\b/.test(hay) && /\b(iphone|galaxy|xiaomi|ipad)\b/.test(hay)) {
    return true;
  }
  if (/\bsmartphone\b/.test(hay)) return true;
  if (/\b(cell\s?phone|mobile\s+phone)\b/.test(hay)) return true;

  // iPad
  if (/\bipad\b/.test(hay) && /\b(pro|air|mini)\b/.test(hay)) {
    if (/\b\d+\s*(gb|tb)\b/i.test(title) || /\b(wifi|cellular|5g)\b/.test(hay)) return true;
  }

  // MacBook — whole laptops only, not panels/parts.
  if (looksLikeMacBookLaptop(hay, category)) return true;

  // NVIDIA RTX graphics cards
  if (/\brtx\s*\d{4}\b/i.test(hay) || /\bgeforce\s*rtx\b/i.test(hay)) {
    if (
      !/\b(water\s*block|backplate|bracket|riser|fan\s*only|cooler\s*only|thermal\s*paste|repaste)\b/.test(
        hay
      )
    ) {
      return true;
    }
  }
  if (/\bgraphics\s+card\b/.test(hay) && /\b(nvidia|rtx|geforce)\b/.test(hay)) {
    return true;
  }

  // Nintendo Switch consoles (not controllers / cases / docks)
  if (/\b(nintendo\s+)?switch\b/.test(hay)) {
    if (isAccessoryDominantTitle(hay)) return false;
    if (/\b(dock|charging\s+port|joy[-\s]?con|grip|screen\s+protector)\b/.test(hay)) return false;
    if (/\b(console|oled|lite|bundle)\b/.test(hay)) return true;
    if (/\bnintendo\b/.test(hay) && !/\b(for\s+switch|pour\s+switch)\b/.test(hay)) return true;
  }

  // PlayStation / PS5 consoles — not capture cards / accessories
  if (/\b(ps5|playstation\s*5)\b/.test(hay)) {
    if (
      /\b(capture\s+card|game\s+grabber|controller|headset|charging|stand|cover|skin|cooling\s+fan|cooler|fan\s+with)\b/.test(
        hay,
      )
    ) {
      return false;
    }
    if (/\b(console|disc|digital|edition|bundle)\b/.test(hay) || categorySuggestsDevice(category)) {
      return true;
    }
    if (/\bsony\b/.test(hay) || /^playstation/i.test(title.trim())) return true;
  }

  // Generic laptops / notebooks (non-MacBook)
  if (/\b(laptop|notebook)\b/.test(hay) && !isAccessoryDominantTitle(hay)) {
    if (/\b\d+\s*(gb|tb|inch|"|hz)\b/i.test(title) || /\b(intel|amd|ryzen|core\s*i\d)\b/.test(hay)) {
      return true;
    }
  }

  // Monitors / TVs / cameras as primary products
  if (
    /\b(monitor|television|\btv\b|camera|smartwatch|smart\s+watch)\b/.test(hay) &&
    !isAccessoryDominantTitle(hay) &&
    !/\bfor\s+(iphone|samsung|galaxy|ipad|macbook|ps5|switch)\b/.test(hay)
  ) {
    return true;
  }

  // Galaxy Fold / Flip — phones only, not styluses.
  if (/\b(fold|flip)\b/.test(hay) && /\b(samsung|galaxy)\b/.test(hay)) {
    if (/\b(stylus|electromagnetic pen|touch pen|\ss pen\b|pen for)\b/.test(hay)) {
      return false;
    }
    if (/\b(unlocked|5g|\d+\s*(gb|tb))\b/i.test(title)) return true;
    if (/\b(z\s*fold|z\s*flip|galaxy\s*fold)\b/i.test(title) && /\d+\s*(gb|tb)/i.test(title)) {
      return true;
    }
  }

  if (!isAccessoryDominantTitle(hay)) {
    if (/^(apple\s+)?iphone\s+\d/.test(hay)) return true;
    if (/^samsung\s+galaxy\s+[a-z]?\d+/i.test(title)) return true;
    if (/^xiaomi\s+\d+/i.test(title)) return true;
    if (/^apple\s+macbook/i.test(title.trim())) return true;
    if (/^sony\s+playstation/i.test(title.trim())) return true;
    // "iPhone 15 Pro 256GB" without leading Apple
    if (/\biphone\s+\d{2}\b/.test(hay) && /\b(pro|plus|max|\d+\s*(gb|tb))\b/i.test(title)) return true;
  }

  return false;
}

/** Accessory-style listing for a device query (not a primary device). */
export function isAccessoryListing(title: string, query: string): boolean {
  const hay = title.toLowerCase();

  if (isRepairOrPartsListing(hay)) return true;

  for (const term of DEVICE_ACCESSORY_TYPES) {
    if (hay.includes(term)) return true;
  }

  if (looksLikeDevice(title)) return false;

  const tokens = queryTokens(query);

  if (/\bfor\s+/.test(hay) || mentionsDeviceInForClause(hay)) {
    if (tokens.some((t) => hay.includes(`for ${t}`))) return true;
    if (mentionsDeviceInForClause(hay)) return true;
    if (/\bfor\s+(apple\s+)?iphone\b/.test(hay)) return true;
    if (/\bfor\s+samsung\b/.test(hay)) return true;
    if (/\bfor\s+galaxy\b/.test(hay)) return true;
    if (/\bfor\s+ipad\b/.test(hay)) return true;
    if (/\bfor\s+xiaomi\b/.test(hay)) return true;
    if (/\bfor\s+macbook\b/.test(hay)) return true;
    if (/\bfor\s+(ps5|playstation)\b/.test(hay)) return true;
    if (/\bcompatible\s+with\b/.test(hay)) return true;
  }

  for (const term of ACCESSORY_TERMS) {
    if (hay.includes(term)) return true;
  }

  return false;
}

/**
 * Analyze a listing: assign match tier + composite score.
 * Repair/parts and unrelated listings get tier "repair" / "none".
 */
export function analyzeSearchListing(
  title: string,
  query: string,
  options?: { category?: string }
): SearchListingAnalysis {
  const tokens = queryTokens(query);
  if (tokens.length === 0) {
    return { tier: "none", score: 0, isDevice: false };
  }

  const hay = title.toLowerCase();
  const phrase = query.trim().toLowerCase();
  const wantsAccessory = queryWantsAccessory(query);
  const overlap = queryOverlapScore(title, query);

  if (isRepairOrPartsListing(hay)) {
    return { tier: "repair", score: -1, isDevice: false };
  }
  if (
    /\brtx\b/.test(query.toLowerCase()) &&
    /\b(water\s*block|backplate|bracket|riser|fan\s*only|cooler\s*only)\b/.test(hay)
  ) {
    return { tier: "repair", score: -1, isDevice: false };
  }
  if (overlap === 0) {
    return { tier: "none", score: 0, isDevice: false };
  }

  let isDevice = looksLikeDevice(title, options?.category);
  const isAccessory = isAccessoryListing(title, query);

  // Category-style queries (laptop, monitor, …): matching non-accessory titles count as primary products.
  if (
    !isDevice &&
    !isAccessory &&
    !wantsAccessory &&
    /\b(laptop|notebook|monitor|keyboard|mouse|smartwatch|camera|\btv\b|television|tablet)\b/.test(
      phrase,
    ) &&
    titleMatchesQuery(title, query) &&
    !isAccessoryDominantTitle(hay) &&
    !/\b(backpack|stand|holder|bag|sleeve|cooler|cooling pad|dock|capture|filter|brush|case|cover)\b/.test(
      hay,
    )
  ) {
    isDevice = true;
  }

  let tier: ProductMatchTier = "brand";

  if (wantsAccessory && isAccessory) {
    tier = phrase.length >= 2 && hay.includes(phrase) ? "exact" : "model";
  } else if (isDevice) {
    if (phrase.length >= 2 && hay.includes(phrase)) {
      tier = "exact";
    } else if (hasSameModel(title, query)) {
      tier = "model";
    } else if (hasSameSeries(title, query)) {
      tier = "series";
    } else if (hasOfficialBrand(title, query) || brandMatchesQuery(hay, query)) {
      tier = "brand";
    } else {
      tier = "series";
    }
  } else if (isAccessory) {
    tier = "accessory";
  } else if (hasOfficialBrand(title, query) || brandMatchesQuery(hay, query)) {
    tier = "brand";
  } else if (overlap >= 50) {
    tier = "accessory";
  } else {
    return { tier: "none", score: 0, isDevice: false };
  }

  let score = TIER_BASE_SCORE[tier] + overlap + tokens.length * 5;

  if (isDevice) score += 60;
  if (hasOfficialBrand(title, query)) score += 40;

  const firstToken = tokens[0];
  if (hay.startsWith(firstToken) || hay.startsWith(`new ${firstToken}`)) score += 15;
  if (hay.startsWith(`apple ${firstToken}`) || hay.startsWith(`samsung ${firstToken}`)) {
    score += 20;
  }
  if (hay.startsWith("apple ") || hay.startsWith("samsung ") || hay.startsWith("sony ")) {
    score += 12;
  }
  if (hay.startsWith("nvidia ") || hay.startsWith("geforce ")) score += 12;

  if (wantsAccessory && isAccessory) score += 30;

  return { tier, score, isDevice };
}

/**
 * Score a listing title against the search query.
 * Returns -1 only for repair/parts and unrelated listings.
 */
export function scoreSearchRelevance(
  title: string,
  query: string,
  options?: { category?: string }
): number {
  const analysis = analyzeSearchListing(title, query, options);
  if (analysis.tier === "repair" || analysis.tier === "none") return -1;
  return analysis.score;
}

export function isRelevantTitle(
  title: string,
  query: string,
  options?: { category?: string }
): boolean {
  const analysis = analyzeSearchListing(title, query, options);
  return analysis.tier !== "none" && analysis.tier !== "repair";
}

/**
 * Rank listings by smart tiers. Devices first; accessories backfill only when
 * fewer than MIN_DEVICES_BEFORE_HIDING_ACCESSORIES real products were found.
 */
export function rankBySearchRelevance<T>(
  items: T[],
  query: string,
  getTitle: (item: T) => string,
  getCategory?: (item: T) => string | undefined
): T[] {
  const { MIN_DEVICES_BEFORE_HIDING_ACCESSORIES } = MARKETPLACE_SEARCH_DEFAULTS;

  const ranked = items
    .map((item) => {
      const title = getTitle(item);
      const analysis = analyzeSearchListing(title, query, {
        category: getCategory?.(item),
      });
      return { item, ...analysis };
    })
    .filter((row) => row.tier !== "none" && row.tier !== "repair")
    .sort((a, b) => b.score - a.score);

  const devices = ranked.filter((row) => row.isDevice && row.tier !== "accessory");

  if (devices.length >= MIN_DEVICES_BEFORE_HIDING_ACCESSORIES) {
    return devices.map((row) => row.item);
  }

  return ranked.map((row) => row.item);
}
