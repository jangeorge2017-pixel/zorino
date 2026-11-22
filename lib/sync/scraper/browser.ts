import { createRequire } from "node:module";
import type { ScraperStoreConfig } from "@/lib/sync/scraper/types";

type RouteLike = {
  request(): { resourceType(): string };
  abort(): Promise<void>;
  continue(): Promise<void>;
};

type PageLike = {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  content(): Promise<string>;
  route(
    pattern: string,
    handler: (route: RouteLike) => void | Promise<void>,
  ): Promise<void>;
  close(): Promise<void>;
};

type ContextLike = {
  newPage(): Promise<PageLike>;
  close(): Promise<void>;
};

type BrowserLike = {
  newContext(options?: Record<string, unknown>): Promise<ContextLike>;
  isConnected(): boolean;
  close(): Promise<void>;
};

type PlaywrightLike = {
  chromium: {
    launch(options?: Record<string, unknown>): Promise<BrowserLike>;
  };
};

const nodeRequire = createRequire(process.cwd() + "/package.json");

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
] as const;

let browserPromise: Promise<BrowserLike> | null = null;

function pickUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)] ?? USER_AGENTS[0];
}

async function getBrowser(): Promise<BrowserLike> {
  if (browserPromise) {
    const existing = await browserPromise.catch(() => null);
    if (existing?.isConnected()) return existing;
    browserPromise = null;
  }

  browserPromise = Promise.resolve()
    .then(() => {
      const playwright = nodeRequire("playwright") as PlaywrightLike;
      return playwright.chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-background-networking",
          "--disable-extensions",
        ],
      });
    })
    .catch((error) => {
      browserPromise = null;
      throw error;
    });

  return browserPromise;
}

export async function fetchStorefrontHtml(
  url: string,
  config: ScraperStoreConfig,
): Promise<string> {
  const browser = await getBrowser();
  let context: ContextLike | undefined;
  let page: PageLike | undefined;

  try {
    context = await browser.newContext({
      userAgent: pickUserAgent(),
      locale: config.locale,
      timezoneId: "Africa/Cairo",
      viewport: { width: 1440, height: 900 },
      extraHTTPHeaders: {
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": config.locale === "ar-EG" ? "ar-EG,ar;q=0.9,en;q=0.8" : "en-US,en;q=0.9",
        "Upgrade-Insecure-Requests": "1",
        "Cache-Control": "no-cache",
      },
    });
    page = await context.newPage();
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "stylesheet" || type === "font" || type === "media") {
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    return await page.content();
  } finally {
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
  }
}
