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

  // Datacenter-IP diagnostic: does Amazon even serve its homepage to this
  // function's egress IP, and does a cookie-warmed follow-up search differ?
  results.egress = await (async () => {
    try {
      const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36`;
      const home = await fetch("https://www.amazon.com/", {
        headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9" },
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
      });
      const cookieHeader = home.headers.getSetCookie()
        .map((c) => c.split(";")[0])
        .join("; ");
      const cookieWarmed = await fetch(
        "https://www.amazon.com/s?k=iphone+15&ref=nb_sb_noss",
        {
          headers: {
            "User-Agent": ua,
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          },
          redirect: "follow",
          signal: AbortSignal.timeout(30_000),
        },
      );
      const warmed = await cookieWarmed.text();
      return {
        homeStatus: home.status,
        homeLen: home.text ? undefined : undefined,
        cookieCount: cookieHeader.split(";").filter(Boolean).length,
        warmedStatus: cookieWarmed.status,
        warmedLen: warmed.length,
        warmedTitle: warmed.match(/<title>([^<]*)<\/title>/)?.[1] ?? "",
        warmedHasResults: warmed.includes("s-search-result"),
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  })();

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