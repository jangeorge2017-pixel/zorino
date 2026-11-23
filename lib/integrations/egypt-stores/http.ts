export type FetchOptions = {
  headers?: Record<string, string>;
  timeoutMs?: number;
  accept?: string;
};

const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_HTML_BYTES = 4_000_000;

function extractHtmlTitle(text: string): string {
  const match = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1]?.replace(/\s+/g, " ").trim().slice(0, 200) ?? "";
}

function diagnosticsEnabled(): boolean {
  return process.env.SYNC_DIAGNOSTICS === "1";
}

const DEFAULT_HEADERS: Record<string, string> = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "en-EG,en;q=0.9,ar;q=0.8",
};

export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers = {
    ...DEFAULT_HEADERS,
    ...(options.accept ? { accept: options.accept } : {}),
    ...(options.headers ?? {}),
  };

  const response = await fetch(url, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
  });

  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    throw new Error(`Response too large (${contentLength} bytes) for ${url}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
    return "";
  }

  const decoder = new TextDecoder();
  let text = "";
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_HTML_BYTES) {
        throw new Error(`Response too large for ${url}`);
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  const title = extractHtmlTitle(text);
  if (diagnosticsEnabled()) {
    console.log(
      `[storefront-fetch] ${new URL(url).host} ${url} status=${response.status} bytes=${bytes} title="${title}"`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} for ${url} title="${title}" body="${text.slice(0, 300)}"`,
    );
  }

  return text;
}

export async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, {
    ...options,
    accept: options.accept ?? "application/json",
  });
  return JSON.parse(text) as T;
}

function logFetchFailure(url: string, error: unknown): void {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    host = url;
  }
  const message = error instanceof Error ? error.message : String(error);
  console.warn(`[egypt-store-fetch] ${host}: ${message}`);
}

/** Never let one store's network/parse failure escape into the fan-out. */
export async function fetchTextSafely(
  url: string,
  options: FetchOptions = {},
): Promise<string | null> {
  try {
    return await fetchText(url, options);
  } catch (error) {
    logFetchFailure(url, error);
    return null;
  }
}

/** JSON variant of fetchTextSafely — malformed or oversized payloads return null. */
export async function fetchJsonSafely<T>(
  url: string,
  options: FetchOptions = {},
): Promise<T | null> {
  try {
    return await fetchJson<T>(url, options);
  } catch (error) {
    logFetchFailure(url, error);
    return null;
  }
}
