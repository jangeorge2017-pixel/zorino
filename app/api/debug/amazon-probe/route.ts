import { NextResponse } from "next/server";
import {
  isAmazonDirectEnabled,
  isAmazonConfigured,
  getAmazonCredentialStatus,
} from "@/lib/integrations/amazon";
import { isAmazonScraperAvailable } from "@/lib/integrations/amazon-scraper";
import {
  fetchAmazonProductScraper,
  fetchAmazonSearchScraper,
} from "@/lib/integrations/amazon-scraper";
import { hydrateIntegrationCredentials } from "@/lib/integration/credentials";
import { amazonSearchConnector } from "@/lib/search/connectors/amazon";

const TEMP_TOKEN = "d0a5e2f7-debug-raw-9c41";

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("t") !== TEMP_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await hydrateIntegrationCredentials();

  const query = url.searchParams.get("q")?.trim() || "iPhone 15";

  const status = {
    directEnabled: isAmazonDirectEnabled(),
    amazonConfigured: isAmazonConfigured(),
    amazonStatus: getAmazonCredentialStatus(),
    scraper: {
      available: isAmazonScraperAvailable(),
      engine: process.env.AMAZON_SCRAPER_ENGINE ?? "http",
      disabled: process.env.AMAZON_SCRAPER_DISABLED ?? "0",
    },
    envPresent: {
      AMAZON_DIRECT_ENABLE: process.env.AMAZON_DIRECT_ENABLE,
      AMAZON_CREATORS_CLIENT_ID: process.env.AMAZON_CREATORS_CLIENT_ID ?? null,
      AMAZON_CREATORS_CLIENT_SECRET: process.env.AMAZON_CREATORS_CLIENT_SECRET ?? null,
    },
  };

  const results: Record<string, unknown> = { status };

  try {
    const listings = await amazonSearchConnector.search(query, { targetFetch: 10, maxPages: 1 });
    results.searchResults = {
      count: listings.length,
      items: listings.slice(0, 10).map((l) => ({
        provider: l.providerId,
        title: l.title,
        price: l.price,
        currency: l.currency,
        image: l.imageUrl.slice(0, 120),
        url: l.productUrl,
      })),
    };
  } catch (err) {
    results.searchResults = { error: err instanceof Error ? err.message : String(err) };
  }

  try {
    const scraperSearch = await fetchAmazonSearchScraper(query, "amazon-storefront");
    results.scraperSearch = {
      count: scraperSearch.length,
      items: scraperSearch.slice(0, 10).map((p) => ({
        asin: p.asin,
        title: p.title,
        price: p.price,
        currency: p.currency,
      })),
    };
  } catch (err) {
    results.scraperSearch = { error: err instanceof Error ? err.message : String(err) };
  }

  try {
    const scraperSearchEg = await fetchAmazonSearchScraper(query, "amazon-eg");
    results.scraperSearchEg = {
      count: scraperSearchEg.length,
      items: scraperSearchEg.slice(0, 10).map((p) => ({
        asin: p.asin,
        title: p.title,
        price: p.price,
        currency: p.currency,
      })),
    };
  } catch (err) {
    results.scraperSearchEg = { error: err instanceof Error ? err.message : String(err) };
  }

  try {
    const scraperProduct = await fetchAmazonProductScraper("B0BN6RVLQJ", "amazon-storefront");
    results.scraperProduct = scraperProduct
      ? { ok: true, title: scraperProduct.title, price: scraperProduct.price, inStock: scraperProduct.inStock }
      : { ok: false, reason: "null/empty" };
  } catch (err) {
    results.scraperProduct = { error: err instanceof Error ? err.message : String(err) };
  }

  return NextResponse.json(results);
}