import { normalizeArabicText } from "@/lib/search/text-normalization";
import { translateWithCache } from "@/lib/search/translation";
import { setBoundedCacheEntry } from "@/lib/utils/bounded-map-cache";

export type ArabicSearchExpansion = {
  english: string[];
  arabic: string[];
};

const ARABIC_RE = /[\u0600-\u06FF]/;
const DYNAMIC_CACHE_LIMIT = 500;
const DYNAMIC_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const DYNAMIC_TRANSLATION_TIMEOUT_MS = 120;

const TRANSLITERATION: Readonly<Record<string, string>> = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "g",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  ة: "a",
  و: "w",
  ي: "y",
  ى: "a",
};

const DICTIONARY_SOURCE: Readonly<Record<string, readonly string[]>> = {
  ايفون: ["iphone"],
  آيفون: ["iphone"],
  جوال: ["phone", "mobile", "smartphone"],
  موبايل: ["phone", "mobile", "smartphone"],
  هاتف: ["phone", "mobile", "smartphone"],
  تلفون: ["phone", "mobile", "smartphone"],
  سامسونج: ["samsung"],
  جالاكسي: ["galaxy"],
  نوت: ["note"],
  شاومي: ["xiaomi"],
  ريدمي: ["redmi"],
  هواوي: ["huawei"],
  اوبو: ["oppo"],
  فيفو: ["vivo"],
  ريلمي: ["realme"],
  بكسل: ["pixel"],
  "ون بلس": ["oneplus"],
  ايباد: ["ipad"],
  "ماك بوك": ["macbook"],
  لابتوب: ["laptop", "notebook"],
  كمبيوتر: ["computer", "pc"],
  طابعات: ["printer"],
  طابعة: ["printer"],
  شاشة: ["screen", "monitor", "display"],
  شاشه: ["screen", "monitor", "display"],
  تكييف: ["air conditioner", "ac"],
  مكيف: ["air conditioner", "ac"],
  ثلاجة: ["refrigerator", "fridge", "freezer"],
  تلاجة: ["refrigerator", "fridge", "freezer"],
  فريزر: ["freezer"],
  غسالة: ["washing machine", "washer"],
  غساله: ["washing machine", "washer"],
  بوتاجاز: ["cooker", "gas cooker", "stove", "oven"],
  بوتجاز: ["cooker", "gas cooker", "stove", "oven"],
  بوتاغاز: ["cooker", "gas cooker", "stove", "oven"],
  فرن: ["oven"],
  ميكرويف: ["microwave"],
  مايكرويف: ["microwave"],
  مايكروويف: ["microwave"],
  مكنسة: ["vacuum", "vacuum cleaner", "hoover"],
  مكنسه: ["vacuum", "vacuum cleaner", "hoover"],
  خلاط: ["blender", "mixer"],
  مكواة: ["iron", "clothes iron"],
  مكوه: ["iron", "clothes iron"],
  سخان: ["water heater", "heater"],
  مروحة: ["fan"],
  لمبة: ["bulb", "light"],
  جراب: ["case", "cover"],
  كفر: ["case", "cover"],
  حافظة: ["case", "cover"],
  غلاف: ["case", "cover"],
  اسكرينة: ["screen protector", "protector", "tempered glass"],
  اسكرينه: ["screen protector", "protector", "tempered glass"],
  اسكرين: ["screen protector", "protector", "tempered glass"],
  ا스크رينة: ["screen protector", "protector", "tempered glass"],
  شاحن: ["charger"],
  كابل: ["cable"],
  سماعة: ["headphone", "earbuds", "headset"],
  سماعات: ["headphones", "earbuds", "headset"],
  بطارية: ["battery"],
  برفان: ["perfume", "fragrance"],
  عطر: ["perfume", "fragrance"],
  كريم: ["cream"],
  شامبو: ["shampoo"],
  مكياج: ["makeup"],
  "مستحضرات تجميل": ["cosmetics", "makeup"],
  حذاء: ["shoes"],
  جزمة: ["boots"],
  قميص: ["shirt"],
  تيشيرت: ["t-shirt"],
  جاكيت: ["jacket"],
  بنطال: ["pants"],
  فستان: ["dress"],
  حقيبة: ["bag", "handbag"],
  ساعة: ["watch"],
  نظارة: ["glasses"],
  كرة: ["ball"],
  دراجة: ["bicycle", "bike"],
  دمبل: ["dumbbell"],
  سيارة: ["car"],
  اطار: ["tire"],
  زيت: ["oil"],
  اطفال: ["baby", "kids"],
  لعبة: ["toy"],
  حليب: ["milk", "formula"],
  عربة: ["stroller"],
  مثقاب: ["drill"],
  مفك: ["screwdriver"],
  منشار: ["saw"],
  ادوات: ["tools"],
  سرير: ["bed"],
  كرسي: ["chair"],
  طاولة: ["table"],
  دولاب: ["wardrobe"],
  سجادة: ["carpet", "rug"],
  وسادة: ["pillow"],
  لحاف: ["blanket"],
};

const DICTIONARY = new Map<string, string[]>();
for (const [key, values] of Object.entries(DICTIONARY_SOURCE)) {
  const normalizedKey = normalizeArabicSearch(key);
  const normalizedValues = values.map((value) => normalizeArabicSearch(value));
  DICTIONARY.set(normalizedKey, [
    ...new Set([...(DICTIONARY.get(normalizedKey) ?? []), ...normalizedValues]),
  ]);
}

const DYNAMIC_CACHE = new Map<string, { values: string[]; expiresAt: number }>();

function isArabicToken(token: string): boolean {
  return ARABIC_RE.test(token);
}

function transliterateToken(token: string): string {
  return [...token].map((char) => TRANSLITERATION[char] ?? "").join("");
}

function readDynamicCache(token: string): string[] | null {
  const entry = DYNAMIC_CACHE.get(token);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    DYNAMIC_CACHE.delete(token);
    return null;
  }
  DYNAMIC_CACHE.delete(token);
  DYNAMIC_CACHE.set(token, entry);
  return entry.values;
}

function writeDynamicCache(token: string, values: string[]): void {
  DYNAMIC_CACHE.delete(token);
  setBoundedCacheEntry(
    DYNAMIC_CACHE,
    token,
    { values, expiresAt: Date.now() + DYNAMIC_CACHE_TTL_MS },
    DYNAMIC_CACHE_LIMIT,
  );
}

export function resetArabicSearchDynamicCacheForTests(): void {
  DYNAMIC_CACHE.clear();
}

export function normalizeArabicSearch(text: string): string {
  return normalizeArabicText(text)
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^ال(?=.{2,})/, ""))
    .filter(Boolean)
    .join(" ")
    .trim();
}

export function getArabicSearchExpansionSync(query: string): ArabicSearchExpansion {
  const normalized = normalizeArabicSearch(query);
  const tokens = normalized.split(/\s+/).filter(Boolean);
  const english = new Set<string>();
  const arabic = new Set<string>();

  for (const token of tokens) {
    if (isArabicToken(token)) arabic.add(token);
    for (const value of DICTIONARY.get(token) ?? []) english.add(value);
  }

  for (const [key, values] of DICTIONARY) {
    if (!key.includes(" ")) continue;
    if (normalized !== key && !normalized.includes(` ${key} `)) continue;
    for (const token of key.split(/\s+/)) arabic.add(token);
    for (const value of values) english.add(value);
  }

  return { english: [...english], arabic: [...arabic] };
}

async function translateArabicToken(token: string): Promise<string[]> {
  const cached = readDynamicCache(token);
  if (cached) return cached;

  let translated = token;
  try {
    const timeout = new Promise<string>((resolve) => {
      setTimeout(() => resolve(token), DYNAMIC_TRANSLATION_TIMEOUT_MS);
    });
    translated = await Promise.race([translateWithCache(token, "en", "ar"), timeout]);
  } catch {
    translated = token;
  }

  const values = new Set<string>();
  const normalizedTranslated = normalizeArabicSearch(translated);
  if (normalizedTranslated !== token && !isArabicToken(normalizedTranslated)) {
    for (const part of normalizedTranslated.split(/\s+/)) {
      if (part.length > 1) values.add(part);
    }
  }
  const fallback = transliterateToken(token);
  if (fallback.length > 1) values.add(fallback);

  const result = [...values];
  writeDynamicCache(token, result);
  return result;
}

export async function expandArabicSearchQuery(
  query: string,
  options?: { allowDynamicTranslation?: boolean },
): Promise<ArabicSearchExpansion> {
  const expansion = getArabicSearchExpansionSync(query);
  if (options?.allowDynamicTranslation === false) return expansion;

  const english = new Set(expansion.english);
  const tokens = normalizeArabicSearch(query)
    .split(/\s+/)
    .filter((token) => token.length > 1 && isArabicToken(token) && !DICTIONARY.has(token));

  for (const values of await Promise.all(tokens.map((token) => translateArabicToken(token)))) {
    for (const value of values) english.add(value);
  }

  return { english: [...english], arabic: expansion.arabic };
}
