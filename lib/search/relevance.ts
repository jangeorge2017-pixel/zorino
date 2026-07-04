/**
 * Marketplace-agnostic search relevance for device/product queries.
 * Used by AliExpress, eBay, and future provider integrations.
 *
 * Phase 3: device-first ranking, repair/parts exclusion, official-brand preference.
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
  /** Scan extra API pages when page 1 is mostly accessories. */
  MAX_PAGES: 8,
  /** Default search results shown on the first page. */
  DEFAULT_LIMIT: 24,
} as const;

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
    /\b(for\s+macbook|pour\s+macbook|replacement|panel|mother|magsafe|ssd|connector|jack|keycap|chip|stencil|genuine\s+for|genuine\s+oem|820-|logic\s*board|main\s*board|map\b)\b/.test(
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

  return null;
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

  // PlayStation / PS5
  if (/\b(ps5|playstation\s*5)\b/.test(hay)) {
    if (/\b(console|disc|digital|edition|bundle)\b/.test(hay) || categorySuggestsDevice(category)) {
      return true;
    }
    if (/\bsony\b/.test(hay) || /^playstation/i.test(title.trim())) return true;
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
 * Score a listing title against the search query.
 * Returns -1 when the listing must be rejected.
 */
export function scoreSearchRelevance(
  title: string,
  query: string,
  options?: { category?: string }
): number {
  const tokens = queryTokens(query);
  if (tokens.length === 0) return -1;

  const hay = title.toLowerCase();
  if (!titleMatchesQuery(title, query)) return -1;

  const wantsAccessory = queryWantsAccessory(query);
  if (!wantsAccessory) {
    if (isRepairOrPartsListing(hay)) return -1;
    if (isAccessoryListing(title, query)) return -1;
    if (!looksLikeDevice(title, options?.category)) return -1;

    const requiredBrands = requiredBrandsForQuery(query);
    if (requiredBrands && !hasOfficialBrand(title, query)) {
      return -1;
    }
  }

  let score = tokens.length * 10;
  const phrase = query.trim().toLowerCase();

  if (phrase.length >= 2 && hay.includes(phrase)) score += 25;

  if (looksLikeDevice(title, options?.category)) score += 60;

  if (hasOfficialBrand(title, query)) score += 25;

  const firstToken = tokens[0];
  if (hay.startsWith(firstToken) || hay.startsWith(`new ${firstToken}`)) score += 10;
  if (hay.startsWith(`apple ${firstToken}`) || hay.startsWith(`samsung ${firstToken}`)) {
    score += 15;
  }
  if (hay.startsWith("apple ") || hay.startsWith("samsung ") || hay.startsWith("sony ")) {
    score += 10;
  }

  if (wantsAccessory && isAccessoryListing(title, query)) score += 20;

  return score;
}

export function isRelevantTitle(
  title: string,
  query: string,
  options?: { category?: string }
): boolean {
  return scoreSearchRelevance(title, query, options) >= 0;
}

/** Filter and rank listings — highest device relevance first. */
export function rankBySearchRelevance<T>(
  items: T[],
  query: string,
  getTitle: (item: T) => string,
  getCategory?: (item: T) => string | undefined
): T[] {
  return items
    .map((item) => ({
      item,
      score: scoreSearchRelevance(getTitle(item), query, {
        category: getCategory?.(item),
      }),
    }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}
