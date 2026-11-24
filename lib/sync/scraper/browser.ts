import { createRequire } from "node:module";
import type { ScraperStoreConfig } from "@/lib/sync/scraper/types";

type RouteLike = {
  request(): { resourceType(): string };
  abort(): Promise<void>;
  continue(): Promise<void>;
};

type NavigationResponseLike = {
  status(): number;
  url(): string;
};

type PageLike = {
  addInitScript(script: string): Promise<void> | void;
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

function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim().slice(0, 200) ?? "";
}

function diagnosticsEnabled(): boolean {
  return process.env.SYNC_DIAGNOSTICS === "1";
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
        ignoreDefaultArgs: ["--enable-automation"],
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--disable-background-networking",
          "--disable-extensions",
          "--disable-blink-features=AutomationControlled",
        ],
      });
    })
    .catch((error) => {
      browserPromise = null;
      throw error;
    });

  return browserPromise;
}

export type StorefrontHtmlResult = {
  html: string;
  status: number;
  finalUrl: string;
  title: string;
};

export async function fetchStorefrontHtml(
  url: string,
  config: ScraperStoreConfig,
  timeoutMs = 30_000,
): Promise<StorefrontHtmlResult> {
  const navigationTimeout = Math.max(1, Math.min(Math.floor(timeoutMs), 30_000));
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
    await page.addInitScript(`
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
      Object.defineProperty(navigator, "languages", { get: () => ["en-US", "en"] });
      Object.defineProperty(navigator, "plugins", { get: () => [] });
    `);
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (type === "image" || type === "stylesheet" || type === "font" || type === "media") {
        return route.abort();
      }
      return route.continue();
    });
    const navigationResponse = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: navigationTimeout,
    });
    const html = await page.content();
    const status =
      typeof (navigationResponse as NavigationResponseLike | null)?.status === "function"
        ? (navigationResponse as NavigationResponseLike).status()
        : 0;
    const finalUrl =
      typeof (navigationResponse as NavigationResponseLike | null)?.url === "function"
        ? (navigationResponse as NavigationResponseLike).url()
        : url;
    const title = extractHtmlTitle(html);

    if (diagnosticsEnabled()) {
      console.log(
        `[scraper-fetch] ${config.id} ${finalUrl} status=${status} bytes=${html.length} title="${title}"`,
      );
    }

    return { html, status, finalUrl, title };
  } finally {
    await page?.close().catch(() => {});
    await context?.close().catch(() => {});
  }
}
