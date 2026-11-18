type EgyptStoreAffiliateConfig = {
  envKey: string;
  mode: "wrap" | "tag";
  defaultParam?: string;
};

const STORE_AFFILIATE_CONFIG: Record<string, EgyptStoreAffiliateConfig> = {
  jumia: { envKey: "JUMIA_AFF_PREFIX", mode: "wrap" },
  noon: { envKey: "NOON_AFF_TAG", mode: "tag", defaultParam: "utm_source" },
  temu: { envKey: "TEMU_AFF_TAG", mode: "tag", defaultParam: "utm_source" },
  carrefour: { envKey: "CARREFOUR_AFF_TAG", mode: "tag", defaultParam: "utm_source" },
  btech: { envKey: "BTECH_AFF_TAG", mode: "tag", defaultParam: "utm_source" },
  twob: { envKey: "TWOB_AFF_TAG", mode: "tag", defaultParam: "utm_source" },
  dubaiphone: { envKey: "DUBAIPHONE_AFF_TAG", mode: "tag", defaultParam: "utm_source" },
  raneen: { envKey: "RANEEN_AFF_TAG", mode: "tag", defaultParam: "utm_source" },
  eldokan: { envKey: "ELDOKAN_AFF_TAG", mode: "tag", defaultParam: "utm_source" },
};

function compact(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function resolveEgyptStoreKey(storeName: string): string | null {
  const key = compact(storeName);
  if (STORE_AFFILIATE_CONFIG[key]) return key;
  const aliases: Record<string, string> = {
    jumiaegypt: "jumia",
    noonegypt: "noon",
    temuegypt: "temu",
    carrefoureghypt: "carrefour",
    btechstore: "btech",
    twobegypt: "twob",
    "2b": "twob",
    twobcom: "twob",
    dubai: "dubaiphone",
    dubaiphonestore: "dubaiphone",
    raneenstore: "raneen",
    eldokanstore: "eldokan",
    dokan: "eldokan",
  };
  return aliases[key] ?? null;
}

function appendTag(rawUrl: string, tag: string, defaultParam: string): string {
  try {
    const url = new URL(rawUrl);
    const trimmed = tag.trim();
    if (!trimmed) return rawUrl;
    if (trimmed.includes("=")) {
      const extra = new URLSearchParams(trimmed);
      for (const [key, value] of extra) {
        if (!url.searchParams.has(key)) url.searchParams.set(key, value);
      }
      return url.toString();
    }
    if (!url.searchParams.has(defaultParam)) {
      url.searchParams.set(defaultParam, trimmed);
    }
    return url.toString();
  } catch {
    return rawUrl;
  }
}

function wrapWithPrefix(rawUrl: string, prefix: string): string {
  const trimmed = prefix.trim();
  if (!trimmed) return rawUrl;
  if (trimmed.includes("{url}")) {
    return trimmed.replace(/\{url\}/g, encodeURIComponent(rawUrl));
  }
  if (/[=&]$/.test(trimmed)) {
    return `${trimmed}${encodeURIComponent(rawUrl)}`;
  }
  if (trimmed.includes("?")) {
    return `${trimmed}${trimmed.endsWith("&") ? "" : "&"}url=${encodeURIComponent(rawUrl)}`;
  }
  return `${trimmed}${encodeURIComponent(rawUrl)}`;
}

/**
 * Centralized affiliate builder for the Egyptian store adapters.
 * Returns null for a non-Egyptian store so the legacy builder can handle it.
 */
export function buildEgyptStoreAffiliateUrl(
  storeName: string,
  rawProductUrl: string,
): string | null {
  const key = resolveEgyptStoreKey(storeName);
  if (!key) return null;
  const config = STORE_AFFILIATE_CONFIG[key];
  const value = process.env[config.envKey]?.trim();
  if (!value) return rawProductUrl;
  if (config.mode === "wrap") return wrapWithPrefix(rawProductUrl, value);
  return appendTag(rawProductUrl, value, config.defaultParam ?? "utm_source");
}

/**
 * Affiliate builder used by the Egyptian search connectors.
 * Empty/unconfigured env vars always fall back to the untouched product URL.
 */
export function buildAffiliateUrl(storeName: string, rawProductUrl: string): string {
  return buildEgyptStoreAffiliateUrl(storeName, rawProductUrl) ?? rawProductUrl;
}
