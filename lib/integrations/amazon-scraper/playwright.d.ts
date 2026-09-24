/**
 * Ambient types for the OPTIONAL Playwright engine (AMAZON_SCRAPER_ENGINE=playwright).
 * Playwright is not a dependency of this app (serverless-unsafe); when a
 * self-hosted Node backend installs it, the dynamic import in client.ts resolves
 * the real module. These declarations keep `tsc` happy while it is absent.
 */
declare module "playwright" {
  export interface Browser {
    newPage(options?: Record<string, unknown>): Promise<Page>;
    close(): Promise<void>;
  }
  export interface Page {
    goto(url: string, options?: Record<string, unknown>): Promise<Response | null>;
    content(): Promise<string>;
  }
  export interface Response {
    status(): number;
  }
  export const chromium: {
    launch(options?: Record<string, unknown>): Promise<Browser>;
  };
}