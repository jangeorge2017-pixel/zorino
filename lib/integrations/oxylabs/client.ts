import { getOxylabsCredentials } from "@/lib/integrations/oxylabs/config";

const OXYLABS_API_ENDPOINT = "https://realtime.oxylabs.io/v1/queries";

/**
 * Amazon marketplace/localization targets supported by the Oxylabs
 * `amazon_product` source. Each key maps to the real Amazon storefront domain
 * used in the product URL and to the canonical currency of that marketplace.
 * Kept in sync with how Oxylabs accepts the `domain` query parameter.
 */
export const OXYLABS_AMAZON_MARKETPLACES = {
  "amazon-storefront": {
    domain: "com",
    storeUrl: "https://www.amazon.com",
    currency: "USD",
    locale: "en_US",
    geoLocation: "10001",
  },
  "amazon-co-uk": {
    domain: "co.uk",
    storeUrl: "https://www.amazon.co.uk",
    currency: "GBP",
    locale: "en_GB",
    geoLocation: "SW1A1AA",
  },
  "amazon-eg": {
    domain: "eg",
    storeUrl: "https://www.amazon.eg",
    currency: "EGP",
    locale: "en_AE",
    geoLocation: "11511",
  },
} as const;

export type OxylabsAmazonMarketplaceKey = keyof typeof OXYLABS_AMAZON_MARKETPLACES;

export type OxylabsAmazonProduct = {
  asin: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice: number;
  currency: string;
  productUrl: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  category: string;
  marketplace: OxylabsAmazonMarketplaceKey;
};

type OxylabsApiResponse = {
  results?: Array<{
    content?: OxylabsAmazonContent | OxylabsAmazonContent[];
  }>;
};

type OxylabsAmazonContent = {
  url?: string;
  asin?: string;
  title?: string;
  product_name?: string;
  price?: number;
  price_upper?: number;
  price_initial?: number;
  price_buybox?: number;
  currency?: string;
  images?: string[];
  rating?: number;
  reviews_count?: number;
  stock?: string;
  availability?: string;
  category?: Array<{ ladder?: Array<{ name?: string }> }>;
};

/**
 * The Oxylabs `amazon_product` realtime response returns `results[0].content`
 * as an ARRAY containing the single parsed product object. Normalize both the
 * array form and the (defensive) object form to the product object.
 */
function unwrapContent(
  content: OxylabsAmazonContent | OxylabsAmazonContent[] | undefined
): OxylabsAmazonContent | null {
  if (!content) return null;
  if (Array.isArray(content)) {
    if (content.length === 0) return null;
    return content[0] ?? null;
  }
  return content;
}

function parseStock(stock: string | undefined): boolean {
  if (!stock) return true;
  const lower = stock.toLowerCase();
  return !lower.includes("out of stock") && !lower.includes("unavailable");
}

function parseCategory(category: OxylabsAmazonContent["category"]): string {
  if (!category || category.length === 0) return "General";
  const ladder = category[0]?.ladder;
  if (!ladder || ladder.length === 0) return "General";
  return ladder[0]?.name?.trim() || "General";
}

function parseOxylabsContent(
  content: OxylabsAmazonContent,
  marketplace: OxylabsAmazonMarketplaceKey
): OxylabsAmazonProduct | null {
  const meta = OXYLABS_AMAZON_MARKETPLACES[marketplace];
  const asin = content.asin?.trim();
  const title = (content.title ?? content.product_name ?? "").trim();
  if (!asin || !title) return null;

  // Prefer the buybox price when present (the most accurate current price),
  // then the base price. Oxylabs only returns a price when it is available —
  // with `autoselect_variant` enabled this is the in-stock buybox price.
  const buybox = typeof content.price_buybox === "number" ? content.price_buybox : 0;
  const price = buybox > 0 ? buybox : (content.price ?? 0);
  if (!price || price <= 0) return null;

  const upper = content.price_upper ?? 0;
  const initial = content.price_initial ?? 0;
  const originalPrice = initial > price ? initial : upper > price ? upper : price;

  const images = content.images ?? [];
  const imageUrl = images.find((u) => u.startsWith("http")) ?? "";
  if (!imageUrl) return null;

  // Prefer the real Amazon product URL returned by Oxylabs; otherwise build one
  // from the ASIN on the correct marketplace storefront (so US / UK / EG are
  // never mixed up).
  const productUrl =
    content.url?.trim() || `${meta.storeUrl}/dp/${asin}`;

  return {
    asin,
    title,
    imageUrl,
    price,
    originalPrice,
    currency: content.currency?.trim() || meta.currency,
    productUrl,
    rating: content.rating ?? 0,
    reviewCount: content.reviews_count ?? 0,
    inStock: parseStock(content.stock),
    category: parseCategory(content.category),
    marketplace,
  };
}

/**
 * Fetch a single real Amazon product via the Oxylabs Realtime Scraper API
 * (`source: amazon_product`, `parse: true`) targeted at a specific marketplace.
 * Returns null when credentials are missing, the request fails, or the response
 * does not contain usable product data. Never throws for a normal API failure —
 * callers treat a null result as "no data for this ASIN on this marketplace".
 */
export async function fetchOxylabsAmazonProduct(
  asin: string,
  marketplace: OxylabsAmazonMarketplaceKey = "amazon-storefront"
): Promise<OxylabsAmazonProduct | null> {
  const creds = getOxylabsCredentials();
  if (!creds) return null;

  const trimmed = asin.trim();
  if (!trimmed) return null;

  const auth = Buffer.from(`${creds.username}:${creds.password}`).toString("base64");

  const meta = OXYLABS_AMAZON_MARKETPLACES[marketplace];

  const response = await fetch(OXYLABS_API_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
    },
    body: JSON.stringify({
      source: "amazon_product",
      domain: meta.domain,
      query: trimmed,
      parse: true,
      // Pin the request to the marketplace's geography and interface language so
      // price/currency/buybox reflect the correct regional storefront.
      geo_location: meta.geoLocation,
      locale: meta.locale,
      // Always select the availability/buybox variant so price reflects the
      // actual purchasable offer (which also fixes "Currently unavailable"
      // returning a 0 price).
      context: [{ key: "autoselect_variant", value: true }],
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Oxylabs API ${response.status}: ${(await response.text()).slice(0, 300)}`
    );
  }

  const data = (await response.json()) as OxylabsApiResponse;
  const unwrapped = unwrapContent(data.results?.[0]?.content);
  if (!unwrapped) return null;

  return parseOxylabsContent(unwrapped, marketplace);
}
