import type { CategorySlug } from "@/lib/sync/providers/shared/category-map";
import type { ScraperStoreConfig } from "@/lib/sync/scraper/types";

export const SCRAPER_QUERY_CATEGORIES: Record<string, CategorySlug> = {
  "iPhone 16": "phones",
  "iPhone 15": "phones",
  "iPhone 14": "phones",
  "iPhone 13": "phones",
  "Samsung S24": "phones",
  "Samsung S23": "phones",
  "Samsung A55": "phones",
  "Samsung A35": "phones",
  "Xiaomi Redmi": "phones",
  "OPPO Reno": "phones",
  Realme: "phones",
  MacBook: "laptops",
  "Lenovo IdeaPad": "laptops",
  "Lenovo ThinkPad": "laptops",
  "HP Pavilion": "laptops",
  "Dell Inspiron": "laptops",
  "Asus VivoBook": "laptops",
  iPad: "laptops",
  "Samsung Tab": "laptops",
  "PlayStation 5": "gaming",
  "PS5 Controller": "gaming",
  Xbox: "gaming",
  "Samsung Smart TV": "tvs",
  "LG Smart TV": "tvs",
  "AirPods Pro": "wearables",
  "JBL Headphones": "wearables",
  "Apple Watch": "wearables",
  "Smart Watch": "wearables",
  "Air Fryer": "home",
  "Espresso Machine": "home",
  Tornado: "home",
  Fresh: "home",
  Sharp: "home",
  Refrigerator: "home",
  "Washing Machine": "home",
  "Vacuum Cleaner": "home",
};

export function categoryForScraperQuery(query: string): CategorySlug | undefined {
  return SCRAPER_QUERY_CATEGORIES[query.trim()];
}

export const SCRAPER_SEED_QUERIES = [
  "iPhone 16",
  "iPhone 15",
  "iPhone 14",
  "iPhone 13",
  "Samsung S24",
  "Samsung S23",
  "Samsung A55",
  "Samsung A35",
  "Xiaomi Redmi",
  "OPPO Reno",
  "Realme",
  "MacBook",
  "Lenovo IdeaPad",
  "Lenovo ThinkPad",
  "HP Pavilion",
  "Dell Inspiron",
  "Asus VivoBook",
  "iPad",
  "Samsung Tab",
  "PlayStation 5",
  "PS5 Controller",
  "Xbox",
  "Samsung Smart TV",
  "LG Smart TV",
  "AirPods Pro",
  "JBL Headphones",
  "Apple Watch",
  "Smart Watch",
  "Air Fryer",
  "Espresso Machine",
  "Tornado",
  "Fresh",
  "Sharp",
  "Refrigerator",
  "Washing Machine",
  "Vacuum Cleaner",
  "iphone",
  "samsung galaxy",
  "xiaomi",
  "oppo",
  "laptop",
  "lenovo",
  "hp",
  "dell",
  "asus",
  "smart tv",
  "playstation",
  "airpods",
  "headphones",
  "microwave",
  "coffee machine",
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
  amazon: {
    id: "amazon",
    name: "Amazon US",
    origin: "https://www.amazon.com",
    host: "amazon.com",
    locale: "en-US",
    currency: "USD",
    seeds: SCRAPER_SEED_QUERIES,
    searchUrl: (query, page) => searchUrl("https://www.amazon.com/s", "k", "page", query, page),
  },
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
