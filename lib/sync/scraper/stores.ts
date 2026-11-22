import type { ScraperStoreConfig } from "@/lib/sync/scraper/types";

export const SCRAPER_SEED_QUERIES = [
  "iphone",
  "samsung galaxy",
  "laptop",
  "smart tv",
  "playstation",
  "headphones",
  "smart watch",
  "air fryer",
  "coffee machine",
  "vacuum cleaner",
  "home appliances",
  "gaming",
] as const;

function searchUrl(
  base: string,
  queryParam: string,
  pageParam: string,
  query: string,
  page: number,
): string {
  const url = new URL(base);
  url.searchParams.set(queryParam, query);
  if (page > 1) url.searchParams.set(pageParam, String(page));
  return url.toString();
}

export const SCRAPER_STORES: Record<string, ScraperStoreConfig> = {
  "amazon-eg": {
    id: "amazon-eg",
    name: "Amazon Egypt",
    origin: "https://www.amazon.eg",
    host: "amazon.eg",
    locale: "en-EG",
    currency: "EGP",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) =>
      searchUrl("https://www.amazon.eg/s", "k", "page", query, page),
  },
  noon: {
    id: "noon",
    name: "Noon Egypt",
    origin: "https://www.noon.com",
    host: "noon.com",
    locale: "en-EG",
    currency: "EGP",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) =>
      searchUrl("https://www.noon.com/egypt-en/search/", "q", "page", query, page),
  },
  jumia: {
    id: "jumia",
    name: "Jumia Egypt",
    origin: "https://www.jumia.com.eg",
    host: "jumia.com.eg",
    locale: "en-EG",
    currency: "EGP",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) =>
      searchUrl("https://www.jumia.com.eg/catalog/", "q", "page", query, page),
  },
  carrefour: {
    id: "carrefour",
    name: "Carrefour Egypt",
    origin: "https://www.carrefouregypt.com",
    host: "carrefouregypt.com",
    locale: "en-EG",
    currency: "EGP",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) =>
      searchUrl("https://www.carrefouregypt.com/search", "q", "page", query, page),
  },
  btech: {
    id: "btech",
    name: "B-Tech",
    origin: "https://www.btech.com",
    host: "btech.com",
    locale: "en-EG",
    currency: "EGP",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) =>
      searchUrl("https://www.btech.com/catalogsearch/result/", "q", "p", query, page),
  },
  temu: {
    id: "temu",
    name: "Temu",
    origin: "https://www.temu.com",
    host: "temu.com",
    locale: "en-EG",
    currency: "EGP",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) =>
      searchUrl("https://www.temu.com/search_result.html", "search_key", "page", query, page),
  },
  aliexpress: {
    id: "aliexpress",
    name: "AliExpress",
    origin: "https://www.aliexpress.com",
    host: "aliexpress.com",
    locale: "en-US",
    currency: "USD",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) => {
      const url = new URL(
        `https://www.aliexpress.com/w/wholesale-${encodeURIComponent(query)}.html`,
      );
      if (page > 1) url.searchParams.set("page", String(page));
      return url.toString();
    },
  },
  ebay: {
    id: "ebay",
    name: "eBay",
    origin: "https://www.ebay.com",
    host: "ebay.com",
    locale: "en-US",
    currency: "USD",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) =>
      searchUrl("https://www.ebay.com/sch/i.html", "_nkw", "_pgn", query, page),
  },
  admitad: {
    id: "admitad",
    name: "Alibaba",
    origin: "https://www.alibaba.com",
    host: "alibaba.com",
    locale: "en-US",
    currency: "USD",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) =>
      searchUrl("https://www.alibaba.com/trade/search", "SearchText", "page", query, page),
  },
};
