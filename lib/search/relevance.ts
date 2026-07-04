/**
 * Marketplace-agnostic search relevance for device/product queries.
 * Used by AliExpress, eBay, and future provider integrations.
 *
 * - Requires all query tokens in the listing title.
 * - Rejects accessory listings (cases, chargers, mounts, etc.) unless the
 *   user explicitly searched for an accessory term.
 * - Boosts actual devices (phones, tablets) over ambiguous matches.
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

/** Category names that strongly suggest a primary device listing. */
export const DEVICE_CATEGORY_HINTS = [
  "phones",
  "telecommunication",
  "tablet",
  "computer",
  "laptop",
  "notebook",
] as const;

export const MARKETPLACE_SEARCH_DEFAULTS = {
  /** AliExpress affiliate API max page_size; eBay Browse max is also 50. */
  PAGE_SIZE: 50,
  /** Scan extra API pages when page 1 is mostly accessories. */
  MAX_PAGES: 4,
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
  return ACCESSORY_TERMS.some((term) => phrase.includes(term));
}

function categorySuggestsDevice(category?: string): boolean {
  if (!category?.trim()) return false;
  const hay = category.toLowerCase();
  return DEVICE_CATEGORY_HINTS.some((hint) => hay.includes(hint));
}

function isAccessoryDominantTitle(hay: string): boolean {
  // In-box extras on a phone listing (e.g. "Includes Charging Cable") are not accessories.
  if (
    /\b\d+\s*(gb|tb)\b/.test(hay) &&
    /\b(includes|with)\b/.test(hay) &&
    /\b(cable|charger|adapter)\b/.test(hay)
  ) {
    return false;
  }

  return ACCESSORY_TERMS.some((term) => hay.includes(term));
}

/**
 * Heuristic: listing looks like a primary device (phone/tablet/laptop),
 * not an accessory — even if the title mentions cables in the box.
 */
export function looksLikeDevice(title: string, category?: string): boolean {
  const hay = title.toLowerCase();

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

  if (/\b\d+\s*(gb|tb)\b/i.test(title)) {
    if (/\bipad\b/.test(hay)) return true;
    if (/\biphone\b/.test(hay)) return true;
    if (/\bgalaxy\b/.test(hay)) return true;
    if (/\bxiaomi\b/.test(hay) || /\bredmi\b/.test(hay)) return true;
    if (categorySuggestsDevice(category)) return true;
    if (/\b(unlocked|smartphone|dual\s+sim|5g)\b/.test(hay)) return true;
  }

  if (/\b(gsm\s+)?unlocked\b/.test(hay) && /\b(iphone|galaxy|xiaomi|ipad)\b/.test(hay)) {
    return true;
  }
  if (/\bsmartphone\b/.test(hay)) return true;
  if (/\b(cell\s?phone|mobile\s+phone)\b/.test(hay)) return true;

  if (/\bipad\b/.test(hay) && /\b(pro|air|mini)\b/.test(hay) && /\b\d+\s*(gb|tb)\b/i.test(title)) {
    return true;
  }

  if (!isAccessoryDominantTitle(hay)) {
    if (/^(apple\s+)?iphone\s+\d/.test(hay)) return true;
    if (/^samsung\s+galaxy\s+[a-z]?\d+/i.test(title)) return true;
    if (/^xiaomi\s+\d+/i.test(title)) return true;
  }

  return false;
}

/** Accessory-style listing for a device query (not a primary device). */
export function isAccessoryListing(title: string, query: string): boolean {
  if (looksLikeDevice(title)) return false;

  const hay = title.toLowerCase();
  const tokens = queryTokens(query);

  if (/\bfor\s+/.test(hay)) {
    if (tokens.some((t) => hay.includes(`for ${t}`))) return true;
    if (/\bfor\s+(apple\s+)?iphone\b/.test(hay)) return true;
    if (/\bfor\s+samsung\b/.test(hay)) return true;
    if (/\bfor\s+galaxy\b/.test(hay)) return true;
    if (/\bfor\s+ipad\b/.test(hay)) return true;
    if (/\bfor\s+xiaomi\b/.test(hay)) return true;
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
  if (!tokens.every((token) => hay.includes(token))) return -1;

  const wantsAccessory = queryWantsAccessory(query);
  if (!wantsAccessory && isAccessoryListing(title, query)) return -1;

  let score = tokens.length * 10;
  const phrase = query.trim().toLowerCase();

  if (phrase.length >= 2 && hay.includes(phrase)) score += 25;

  if (looksLikeDevice(title, options?.category)) score += 60;

  const firstToken = tokens[0];
  if (hay.startsWith(firstToken) || hay.startsWith(`new ${firstToken}`)) score += 10;
  if (hay.startsWith(`apple ${firstToken}`) || hay.startsWith(`samsung ${firstToken}`)) {
    score += 15;
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
