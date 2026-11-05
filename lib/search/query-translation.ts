import { detectAndTranslateArabic } from "@/lib/search/translation";

/**
 * Franco-Arab (Arabic written in Latin script) to English device-word mapping.
 * Keys are common Franco-Arab spellings, values are canonical English tokens.
 * Sorted longest-first so multi-word phrases match before single words.
 */
const FRANCO_ARAB_TRANSLITERATION: ReadonlyArray<[franco: string, english: string]> = ([
  ["macbook pro", "macbook pro"],
  ["macbook", "macbook"],
  ["airpods", "airpods"],
  ["air pods", "airpods"],
  ["apple watch", "apple watch"],
  ["iphone", "iphone"],
  ["ipad", "ipad"],
  ["apple", "apple"],
  ["pro", "pro"],
  ["max", "max"],
  ["ultra", "ultra"],
  ["mini", "mini"],
  ["plus", "plus"],
  ["fold", "fold"],
  ["flip", "flip"],
  ["galaxy", "galaxy"],
  ["samsung", "samsung"],
  ["pixel", "pixel"],
  ["watch", "watch"],
  ["gb", "gb"],
  ["tb", "tb"],
  ["ayfon", "iphone"],
  ["ayphone", "iphone"],
  ["aifon", "iphone"],
  ["aiphone", "iphone"],
  ["aypad", "ipad"],
  ["aipad", "ipad"],
  ["aypods", "airpods"],
  ["aipods", "airpods"],
  ["aypro", "pro"],
  ["aymax", "max"],
  ["ayultra", "ultra"],
  ["aymini", "mini"],
  ["ayplus", "plus"],
  ["ayfold", "fold"],
  ["ayflip", "flip"],
  ["aygalaxy", "galaxy"],
  ["aysamsung", "samsung"],
  ["aypixel", "pixel"],
  ["aywatch", "watch"],
  ["jigabayt", "gb"],
  ["jigabyte", "gb"],
  ["gigabayt", "gb"],
  ["gigabyte", "gb"],
  ["tirabayt", "tb"],
  ["terabayt", "tb"],
  ["terabyte", "tb"],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

const francoCache = new Map<string, string>();

function transliterateFrancoArab(text: string): string {
  const lower = text.toLowerCase();
  const cached = francoCache.get(lower);
  if (cached) return cached;
  let out = lower;
  for (const [franco, english] of FRANCO_ARAB_TRANSLITERATION) {
    const re = new RegExp(`(?:^|\\s)${franco}(?=$|\\s)`, "gi");
    if (!re.test(out)) continue;
    out = out.replace(re, (match) =>
      match.startsWith(" ") ? ` ${english}` : english,
    );
  }
  const result = out.replace(/\s+/g, " ").trim();
  if (francoCache.size >= 2000) francoCache.clear();
  francoCache.set(lower, result);
  return result;
}

export async function translateSearchQuery(query: string): Promise<{
  originalQuery: string;
  translatedQuery: string;
  wasTranslated: boolean;
  isArabic: boolean;
  isFrancoArab: boolean;
}> {
  if (!query || typeof query !== "string") {
    return {
      originalQuery: query,
      translatedQuery: query,
      wasTranslated: false,
      isArabic: false,
      isFrancoArab: false,
    };
  }

  const trimmed = query.trim();
  if (!trimmed) {
    return {
      originalQuery: query,
      translatedQuery: query,
      wasTranslated: false,
      isArabic: false,
      isFrancoArab: false,
    };
  }

  // First, try Arabic script translation (frozen utility)
  const arabicResult = await detectAndTranslateArabic(trimmed);

  if (arabicResult.wasTranslated) {
    // Arabic script was translated, now apply Franco-Arab on the result
    // in case there are mixed scripts
    const francoResult = transliterateFrancoArab(arabicResult.translatedQuery);
    const wasFrancoTranslated = francoResult !== arabicResult.translatedQuery;
    return {
      originalQuery: query,
      translatedQuery: francoResult,
      wasTranslated: true,
      isArabic: true,
      isFrancoArab: wasFrancoTranslated,
    };
  }

  // Not Arabic script - check for Franco-Arab (Latin script Arabic words)
  const francoResult = transliterateFrancoArab(trimmed);
  const isFrancoArab = francoResult !== trimmed.toLowerCase();

  if (isFrancoArab) {
    return {
      originalQuery: query,
      translatedQuery: francoResult,
      wasTranslated: true,
      isArabic: false,
      isFrancoArab: true,
    };
  }

  // No translation needed
  return {
    originalQuery: query,
    translatedQuery: trimmed,
    wasTranslated: false,
    isArabic: false,
    isFrancoArab: false,
  };
}