import type { CategorySlug } from "@/lib/sync/providers/shared/category-map";
import type { ScraperStoreConfig } from "@/lib/sync/scraper/types";

const SCRAPER_QUERY_CATEGORY_ENTRIES = [
  ["iphone", "phones"],
  ["laptop", "laptops"],
  ["wireless earbuds", "wearables"],
  ["gaming", "gaming"],
  ["smart tv", "tvs"],
  ["air fryer", "home"],
  ["cooker", "home"],
  ["gas cooker", "home"],
  ["sneakers", "fashion"],
  ["perfume", "fashion"],
  ["samsung galaxy", "phones"],
  ["samsung", "phones"],
  ["macbook", "laptops"],
  ["airpods pro", "wearables"],
  ["playstation 5", "gaming"],
  ["samsung smart tv", "tvs"],
  ["coffee machine", "home"],
  ["running shoes", "fashion"],
  ["iphone 16", "phones"],
  ["lenovo ideapad", "laptops"],
  ["jbl headphones", "wearables"],
  ["ps5 controller", "gaming"],
  ["lg smart tv", "tvs"],
  ["microwave", "home"],
  ["backpack", "fashion"],
  ["iphone 15", "phones"],
  ["hp pavilion", "laptops"],
  ["apple watch", "wearables"],
  ["xbox", "gaming"],
  ["monitor", "tvs"],
  ["refrigerator", "home"],
  ["clothing", "fashion"],
  ["samsung s24", "phones"],
  ["dell inspiron", "laptops"],
  ["smart watch", "wearables"],
  ["nintendo switch", "gaming"],
  ["projector", "tvs"],
  ["washing machine", "home"],
  ["iphone 14", "phones"],
  ["asus vivobook", "laptops"],
  ["bluetooth speaker", "wearables"],
  ["gaming mouse", "gaming"],
  ["4k tv", "tvs"],
  ["vacuum cleaner", "home"],
  ["samsung s23", "phones"],
  ["chromebook", "laptops"],
  ["fitness tracker", "wearables"],
  ["mechanical keyboard", "gaming"],
  ["oled tv", "tvs"],
  ["blender", "home"],
  ["xiaomi redmi", "phones"],
  ["ipad", "laptops"],
  ["oppo reno", "phones"],
  ["samsung a55", "phones"],
  ["samsung a35", "phones"],
  ["realme", "phones"],
  ["samsung tab", "laptops"],
  ["espresso machine", "home"],
  ["tornado", "home"],
  ["fresh", "home"],
  ["sharp", "home"],
  ["home appliances", "home"],
  ["headphones", "wearables"],
  ["gaming chair", "gaming"],
  ["iphone 13", "phones"],
  ["lenovo thinkpad", "laptops"],
  ["xiaomi", "phones"],
  ["oppo", "phones"],
  ["lenovo", "laptops"],
  ["hp", "laptops"],
  ["dell", "laptops"],
  ["asus", "laptops"],
  ["playstation", "gaming"],
  ["airpods", "wearables"],
] as const satisfies ReadonlyArray<readonly [string, CategorySlug]>;

export const SCRAPER_QUERY_CATEGORIES: Record<string, CategorySlug> =
  Object.fromEntries(SCRAPER_QUERY_CATEGORY_ENTRIES);

export function categoryForScraperQuery(query: string): CategorySlug | undefined {
  return SCRAPER_QUERY_CATEGORIES[query.trim().toLowerCase()];
}

export const SCRAPER_SEED_QUERIES: readonly string[] =
  SCRAPER_QUERY_CATEGORY_ENTRIES.map(([query]) => query);

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
