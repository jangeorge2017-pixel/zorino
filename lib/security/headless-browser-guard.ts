/**
 * Hard guard for headless browsers (Playwright / Chromium / Puppeteer).
 *
 * A single Chromium instance reserves 350MB+ RSS. Render's `zorino-1` service
 * has a 512MB limit, so any headless browser launch there guarantees an OOM
 * kill. Product retrieval must use lightweight fetch + regex/JSON endpoints.
 *
 * Blocked whenever Render is the host, when explicitly disabled, or in any
 * production runtime. Local development may still opt into a browser engine.
 */
export function isHeadlessBrowserBlocked(): boolean {
  return (
    process.env.RENDER === "true" ||
    process.env.DISABLE_PLAYWRIGHT === "true" ||
    process.env.NODE_ENV === "production"
  );
}

export function assertHeadlessBrowserAllowed(): void {
  if (isHeadlessBrowserBlocked()) {
    throw new Error("Headless browsers are disabled on Render/production");
  }
}
