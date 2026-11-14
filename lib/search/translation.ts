/**
 * Translation utilities for search queries
 * Provides Arabic detection and translation via Google Translate API with LibreTranslate fallback
 */

// Arabic Unicode ranges for detection
const ARABIC_UNICODE_RANGES = [
  [0x0600, 0x06FF], // Arabic
  [0x0750, 0x077F], // Arabic Supplement
  [0x08A0, 0x08FF], // Arabic Extended-A
  [0xFB50, 0xFDFF], // Arabic Presentation Forms-A
  [0xFE70, 0xFEFF], // Arabic Presentation Forms-B
];

// Local Arabic-to-English mapping for common device/search terms (fallback when external APIs fail)
// Sorted longest-first so multi-word phrases match before single words
const ARABIC_TO_ENGLISH: ReadonlyArray<[arabic: string, english: string]> = ([
  ["آيفون", "iphone"],
  ["ايفون", "iphone"],
  ["آي فون", "iphone"],
  ["اى فون", "iphone"],
  ["آيباد", "ipad"],
  ["ايباد", "ipad"],
  ["آي باد", "ipad"],
  ["اى باد", "ipad"],
  ["آيبود", "ipod"],
  ["ايبود", "ipod"],
  ["أيربودز", "airpods"],
  ["ايربودز", "airpods"],
  ["سماعات", "headphones"],
  ["سماعة", "headphone"],
  ["سامسونج", "samsung"],
  ["جالكسي", "galaxy"],
  ["جالكسي", "galaxy"],
  ["جوجل", "google"],
  ["بكسل", "pixel"],
  ["مايكروسوفت", "microsoft"],
  ["سيرفيس", "surface"],
  ["لابتوب", "laptop"],
  ["لاب توب", "laptop"],
  ["ماك بوك", "macbook"],
  ["ماكبوك", "macbook"],
  ["آبل", "apple"],
  ["ابل", "apple"],
  ["ساعة", "watch"],
  ["ساعات", "watches"],
  ["ساعة آبل", "apple watch"],
  ["ساعة ابل", "apple watch"],
  ["برو", "pro"],
  ["ماكس", "max"],
  ["الترا", "ultra"],
  ["الترا", "ultra"],
  ["ميني", "mini"],
  ["بلس", "plus"],
  ["بلس", "plus"],
  ["فولد", "fold"],
  ["فليب", "flip"],
  ["جي بي", "gb"],
  ["جيجابايت", "gb"],
  ["تيرا", "tb"],
  ["تيرابايت", "tb"],
  ["هاتف", "phone"],
  ["هواتف", "phones"],
  ["جوال", "phone"],
  ["جوالات", "phones"],
  ["موبايل", "mobile"],
  ["موبيل", "mobile"],
  ["تابلت", "tablet"],
  ["تابلت", "tablet"],
  ["شاحن", "charger"],
  ["شاحنة", "charger"],
  ["كابل", "cable"],
  ["كيبل", "cable"],
  ["جراب", "case"],
  ["كفر", "case"],
  ["حافظة", "case"],
  ["شاشة", "screen"],
  ["شاشه", "screen"],
  ["بطارية", "battery"],
  ["بطاريه", "battery"],
  ["كاميرا", "camera"],
  ["كاميرة", "camera"],
  ["معالج", "processor"],
  ["بروسيسور", "processor"],
  ["رام", "ram"],
  ["ذاكرة", "memory"],
  ["تخزين", "storage"],
  ["واي فاي", "wifi"],
  ["واى فاى", "wifi"],
  ["بلوتوث", "bluetooth"],
  ["بلوتوت", "bluetooth"],
  ["خمس جي", "5g"],
  ["فور جي", "4g"],
  ["جديد", "new"],
  ["مستعمل", "used"],
  ["مجددة", "refurbished"],
  ["اصلي", "original"],
  ["أصلي", "original"],
  ["مضمون", "guaranteed"],
  ["ضمان", "warranty"],
  ["سعر", "price"],
  ["اسعار", "prices"],
  ["رخيص", "cheap"],
  ["رخيصة", "cheap"],
  ["عروض", "deals"],
  ["عرض", "deal"],
  ["خصم", "discount"],
  ["تخفيض", "discount"],
  ["تخفيضات", "discounts"],
  ["افضل", "best"],
  ["أفضل", "best"],
  ["جديد", "new"],
  ["احدث", "latest"],
  ["أحدث", "latest"],
  ["شاومي", "xiaomi"],
  ["شيومي", "xiaomi"],
  ["ريدمي", "redmi"],
  ["ريدمي نوت", "redmi note"],
  ["بوكو", "poco"],
  ["ون بلس", "oneplus"],
  ["ونبلس", "oneplus"],
  ["أوبو", "oppo"],
  ["اوبو", "oppo"],
  ["فيفو", "vivo"],
  ["ريال مي", "realme"],
  ["ريالمي", "realme"],
  ["موتورولا", "motorola"],
  ["نوكيا", "nokia"],
  ["سوني", "sony"],
  ["إل جي", "lg"],
  ["ال جي", "lg"],
  ["اتش تي سي", "htc"],
  ["بلاك بيري", "blackberry"],
  ["بلاكبيري", "blackberry"],
  ["هواوي", "huawei"],
  ["هواوى", "huawei"],
  ["هونر", "honor"],
  ["انفيديا", "nvidia"],
  ["إنفيديا", "nvidia"],
  ["أيه ام دي", "amd"],
  ["ايه ام دي", "amd"],
  ["انتل", "intel"],
  ["إنتل", "intel"],
  ["آي 3", "i3"],
  ["آي 5", "i5"],
  ["آي 7", "i7"],
  ["آي 9", "i9"],
  ["ام 1", "m1"],
  ["ام 2", "m2"],
  ["ام 3", "m3"],
  ["ار اكس", "rx"],
  ["آر تي اكس", "rtx"],
  ["جى تى اكس", "gtx"],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length);

function transliterateArabic(text: string): string {
  let out = text;
  for (const [arabic, english] of ARABIC_TO_ENGLISH) {
    const re = new RegExp(arabic.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    out = out.replace(re, english);
  }
  return out;
}

// LibreTranslate public endpoints (free, no API key required)
const LIBRETRANSLATE_ENDPOINTS = [
  'https://libretranslate.de/translate',
  'https://translate.argosopentech.com/translate',
  'https://libretranslate.com/translate',
];

/**
 * Detects if a string contains Arabic characters
 */
export function isArabic(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  // Check for Arabic Unicode ranges
  for (const char of text) {
    const code = char.charCodeAt(0);
    for (const [start, end] of ARABIC_UNICODE_RANGES) {
      if (code >= start && code <= end) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Google Translate API configuration
 */
interface GoogleTranslateConfig {
  apiKey: string;
  baseUrl?: string;
}

let translateConfig: GoogleTranslateConfig | null = null;

/**
 * Initialize Google Translate configuration from environment variables
 */
export function initGoogleTranslate(): void {
  const apiKey = process.env.GOOGLE_TRANSLATE_API_KEY;
  if (apiKey) {
    translateConfig = {
      apiKey,
      baseUrl: 'https://translation.googleapis.com/language/translate/v2',
    };
  }
}

/**
 * Check if Google Translate is configured
 */
export function isGoogleTranslateAvailable(): boolean {
  return translateConfig !== null && !!translateConfig.apiKey;
}

/**
 * Translate text using Google Translate API
 * @param text Text to translate
 * @param targetLang Target language code (e.g., 'en')
 * @param sourceLang Source language code (e.g., 'ar') - optional, auto-detect if not provided
 * @returns Translated text or original text on failure
 */
export async function translateText(
  text: string,
  targetLang: string = 'en',
  sourceLang?: string
): Promise<string> {
  if (!text || typeof text !== 'string') return text;
  
  // Initialize config if not already done
  if (!translateConfig) {
    initGoogleTranslate();
  }
  
  if (!translateConfig) {
    // Google Translate not configured, try LibreTranslate fallback
    return translateWithLibreTranslate(text, targetLang, sourceLang);
  }

  try {
    const params = new URLSearchParams({
      q: text,
      target: targetLang,
      key: translateConfig.apiKey,
    });
    
    if (sourceLang) {
      params.set('source', sourceLang);
    }

    const response = await fetch(`${translateConfig.baseUrl}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      console.error(`[translation] Google Translate API error: ${response.status} ${response.statusText}`);
      // Fallback to LibreTranslate
      return translateWithLibreTranslate(text, targetLang, sourceLang);
    }

    const data = await response.json();
    
    if (data.data?.translations?.[0]?.translatedText) {
      const translated = data.data.translations[0].translatedText;
      // Decode HTML entities
      return decodeHtmlEntities(translated);
    }
    
    console.warn('[translation] Unexpected response format from Google Translate');
    // Fallback to LibreTranslate
    return translateWithLibreTranslate(text, targetLang, sourceLang);
  } catch (error) {
    // Handle timeout, network errors, etc.
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn('[translation] Google Translate request timed out');
    } else {
      console.error('[translation] Google Translate error:', error);
    }
    // Fallback to LibreTranslate
    return translateWithLibreTranslate(text, targetLang, sourceLang);
  }
}

/**
 * Decode HTML entities in translated text
 */
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Translate text using LibreTranslate API (free, no API key required)
 * Tries multiple public endpoints for reliability
 * @param text Text to translate
 * @param targetLang Target language code (e.g., 'en')
 * @param sourceLang Source language code (e.g., 'ar') - optional, auto-detect if not provided
 * @returns Translated text or original text on failure
 */
async function translateWithLibreTranslate(
  text: string,
  targetLang: string = 'en',
  sourceLang?: string
): Promise<string> {
  if (!text || typeof text !== 'string') return text;

  const payload = {
    q: text,
    source: sourceLang || 'auto',
    target: targetLang,
    format: 'text',
  };

  for (const endpoint of LIBRETRANSLATE_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        // 10 second timeout per endpoint
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        console.warn(`[translation] LibreTranslate endpoint ${endpoint} error: ${response.status} ${response.statusText}`);
        continue;
      }

      const data = await response.json();
      
      if (data.translatedText) {
        console.log(`[translation] LibreTranslate success via ${endpoint}`);
        return decodeHtmlEntities(data.translatedText);
      }
      
      console.warn(`[translation] LibreTranslate unexpected response format from ${endpoint}`);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[translation] LibreTranslate request timed out for ${endpoint}`);
      } else {
        console.error(`[translation] LibreTranslate error for ${endpoint}:`, error);
      }
      // Try next endpoint
    }
  }

  // All endpoints failed, return original text
  console.warn('[translation] All LibreTranslate endpoints failed, returning original text');
  return text;
}

/**
 * Simple in-memory cache for translations
 */
interface CacheEntry {
  value: string;
  expiresAt: number;
}

const translationCache = new Map<string, CacheEntry>();
const TRANSLATION_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(text: string, targetLang: string, sourceLang?: string): string {
  const source = sourceLang || 'auto';
  return `${source}:${targetLang}:${text}`;
}

/**
 * Get cached translation
 */
function getCachedTranslation(text: string, targetLang: string, sourceLang?: string): string | null {
  const key = getCacheKey(text, targetLang, sourceLang);
  const entry = translationCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    translationCache.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Set cached translation
 */
function setCachedTranslation(text: string, translated: string, targetLang: string, sourceLang?: string): void {
  const key = getCacheKey(text, targetLang, sourceLang);
  translationCache.set(key, {
    value: translated,
    expiresAt: Date.now() + TRANSLATION_CACHE_TTL,
  });
}

/**
 * Translate text with caching
 * @param text Text to translate
 * @param targetLang Target language code (default: 'en')
 * @param sourceLang Source language code (optional, auto-detect if not provided)
 * @returns Translated text
 */
export async function translateWithCache(
  text: string,
  targetLang: string = 'en',
  sourceLang?: string
): Promise<string> {
  if (!text || typeof text !== 'string') return text;
  
  // Check cache first
  const cached = getCachedTranslation(text, targetLang, sourceLang);
  if (cached !== null) {
    return cached;
  }
  
  // Translate
  const translated = await translateText(text, targetLang, sourceLang);
  
  // Cache the result
  setCachedTranslation(text, translated, targetLang, sourceLang);
  
  return translated;
}

/**
 * Detect if query is likely Arabic and translate if needed
 * @param query Search query
 * @returns Object with original query, translated query, and whether translation occurred
 */
export async function detectAndTranslateArabic(query: string): Promise<{
  originalQuery: string;
  translatedQuery: string;
  wasTranslated: boolean;
  isArabic: boolean;
}> {
  if (!query || typeof query !== 'string') {
    return {
      originalQuery: query,
      translatedQuery: query,
      wasTranslated: false,
      isArabic: false,
    };
  }

  const isArabicQuery = isArabic(query);
  
  if (!isArabicQuery) {
    return {
      originalQuery: query,
      translatedQuery: query,
      wasTranslated: false,
      isArabic: false,
    };
  }

  console.log('[translation] Arabic query detected:', query);
  
  // First try local Arabic-to-English mapping for common terms (fast, no network)
  const localTranslation = transliterateArabic(query);
  if (localTranslation !== query) {
    console.log('[translation] Local mapping translated:', { original: query, translated: localTranslation });
    return {
      originalQuery: query,
      translatedQuery: localTranslation,
      wasTranslated: true,
      isArabic: true,
    };
  }

  // Translate Arabic to English via external APIs
  const translatedQuery = await translateWithCache(query, 'en', 'ar');
  
  console.log('[translation] Result:', { original: query, translated: translatedQuery, wasTranslated: translatedQuery !== query });
  
  return {
    originalQuery: query,
    translatedQuery: translatedQuery !== query ? translatedQuery : query,
    wasTranslated: translatedQuery !== query,
    isArabic: true,
  };
}