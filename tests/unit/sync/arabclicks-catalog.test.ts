/**
 * Unit tests — ArabClicks universal feed sync (lib/sync/import/arabclicks-catalog.ts).
 *
 * Covers:
 *  - pure field helpers (price, country, currency, availability, aliases),
 *  - streaming CSV parsing (RFC-4180 quoting, delimiter sniffing, chunk
 *    boundaries, embedded newlines/commas),
 *  - streaming XML parsing (item-tag detection, CDATA, namespace prefixes),
 *  - the end-to-end two-step upsert against a local HTTP fixture feed and a
 *    fake chainable Supabase client (onConflict keys, network identity,
 *    per-row skip/failure isolation, batching, dry-run, deadline, maxItems).
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ARABCLICKS_NETWORK_NAME,
  CsvStreamParser,
  XmlFeedParser,
  extractXmlFields,
  mapFeedRowToItem,
  normalizeCountryCode,
  normalizeFeedCurrency,
  parseFeedAvailability,
  parseFeedPrice,
  syncArabClicksFeed,
} from "@/lib/sync/import/arabclicks-catalog";
import type { SupabaseDb } from "@/lib/supabase/config";

// ── Fixtures / helpers ──────────────────────────────────────────────────

const CSV_HEADER = [
  "title",
  "description",
  "brand",
  "image_url",
  "category",
  "barcode",
  "sku",
  "store",
  "country",
  "price",
  "currency",
  "affiliate_url",
  "product_url",
  "availability",
];

function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvLine(cells: string[]): string {
  return cells.map(csvCell).join(",");
}

const CSV_ROWS = [
  [
    "Wireless Earbuds, Pro",
    "Crisp <b>sound</b> & bass",
    "Acme",
    "https://cdn.example.com/e1.jpg",
    "Electronics/Audio",
    "1234567890123",
    "SKU-1",
    "Noon",
    "EG",
    "1,299.00",
    "EGP",
    "https://track.example.com/a?u=1",
    "https://www.noon.com/eg/e1",
    "true",
  ],
  [
    "Wireless Earbuds Pro Lite",
    "",
    "Acme",
    "https://cdn.example.com/e1b.jpg",
    "Electronics/Audio",
    "1234567890123",
    "SKU-2",
    "Jumia",
    "EG",
    "899",
    "EGP",
    "https://track.example.com/a?u=2",
    "",
    "in stock",
  ],
  [
    "Coffee Grinder",
    "",
    "BrewCo",
    "https://cdn.example.com/c3.jpg",
    "Home/Kitchen",
    "",
    "SKU-3",
    "Noon",
    "SA",
    "49,99",
    "SAR",
    "https://track.example.com/a?u=3",
    "",
    "out of stock",
  ],
  ["Broken Row", "", "", "https://cdn.example.com/x.jpg", "", "", "", "Noon", "EG", "", "EGP", "https://track.example.com/a?u=4", "", ""],
  ["No Store Row", "", "", "", "", "", "", "", "EG", "10", "EGP", "https://track.example.com/a?u=5", "", "true"],
].map(csvLine);

const CSV_FEED = `${csvLine(CSV_HEADER)}\r\n${CSV_ROWS.join("\r\n")}\r\n`;

const servers: Array<{ close: () => Promise<void> }> = [];

async function startFeedServer(
  body: string,
  opts: { status?: number; contentType?: string; chunkSize?: number } = {},
): Promise<string> {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    res.statusCode = opts.status ?? 200;
    res.setHeader("content-type", opts.contentType ?? "text/csv");
    if (!opts.chunkSize) {
      res.end(body);
      return;
    }
    for (let i = 0; i < body.length; i += opts.chunkSize) {
      res.write(body.slice(i, i + opts.chunkSize));
      await new Promise((r) => setTimeout(r, 1));
    }
    res.end();
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  servers.push({
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  });
  return `http://127.0.0.1:${port}/feed?token=SECRET`;
}

type UpsertCall = { row: Record<string, unknown>; options: Record<string, unknown> };

type FakeSupabaseHooks = {
  productId?: (row: Record<string, unknown>) => string | undefined;
  failProduct?: (row: Record<string, unknown>) => boolean;
  failOffer?: (row: Record<string, unknown>) => boolean;
};

function createFakeSupabase(hooks: FakeSupabaseHooks = {}) {
  const state = {
    products: [] as UpsertCall[],
    offers: [] as UpsertCall[],
    seq: 0,
  };

  const client = {
    from(table: string) {
      return {
        upsert(row: Record<string, unknown>, options: Record<string, unknown>) {
          if (table === "products") state.products.push({ row, options });
          if (table === "product_offers") state.offers.push({ row, options });
          return {
            select() {
              return {
                single: async () => {
                  if (hooks.failProduct?.(row)) {
                    return { data: null, error: new Error("product upsert failed") };
                  }
                  state.seq += 1;
                  return {
                    data: { id: hooks.productId?.(row) ?? `pid-${state.seq}` },
                    error: null,
                  };
                },
              };
            },
            then(resolve: (value: unknown) => void) {
              if (table === "product_offers" && hooks.failOffer?.(row)) {
                resolve({ error: new Error("offer upsert failed") });
                return;
              }
              resolve({ data: null, error: null });
            },
          };
        },
      };
    },
  };

  return { client: client as unknown as SupabaseDb, state };
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (servers.length) {
    await servers.pop()!.close();
  }
});

// ── Pure helpers ────────────────────────────────────────────────────────

describe("parseFeedPrice", () => {
  it("parses US grouping and decimals", () => {
    expect(parseFeedPrice("1,299.00")).toBe(1299);
    expect(parseFeedPrice("$12,345.67")).toBe(12345.67);
  });

  it("parses European grouping and decimals", () => {
    expect(parseFeedPrice("1.299,00")).toBe(1299);
    expect(parseFeedPrice("49,99")).toBe(49.99);
  });

  it("treats a single 3-digit group as thousands", () => {
    expect(parseFeedPrice("1,999")).toBe(1999);
  });

  it("parses Arabic-Indic digits and currency suffixes", () => {
    expect(parseFeedPrice("١٢٩٩٫٥٠ ج.م")).toBe(1299.5);
    expect(parseFeedPrice("EGP 250")).toBe(250);
  });

  it("rejects missing, non-numeric, non-positive and absurd values", () => {
    expect(parseFeedPrice("")).toBeNull();
    expect(parseFeedPrice(null)).toBeNull();
    expect(parseFeedPrice("free")).toBeNull();
    expect(parseFeedPrice("0")).toBeNull();
    expect(parseFeedPrice("-5")).toBeNull();
    expect(parseFeedPrice("99999999999999")).toBeNull();
  });
});

describe("normalizeCountryCode", () => {
  it("passes ISO2 through and maps ISO3 / names / Arabic", () => {
    expect(normalizeCountryCode("eg")).toBe("EG");
    expect(normalizeCountryCode("Egypt")).toBe("EG");
    expect(normalizeCountryCode("مصر")).toBe("EG");
    expect(normalizeCountryCode("SAU")).toBe("SA");
    expect(normalizeCountryCode("Saudi Arabia")).toBe("SA");
    expect(normalizeCountryCode("الإمارات")).toBe("AE");
  });

  it("returns null for empty / unknown", () => {
    expect(normalizeCountryCode("")).toBeNull();
    expect(normalizeCountryCode(null)).toBeNull();
    expect(normalizeCountryCode("Wakanda")).toBeNull();
  });
});

describe("normalizeFeedCurrency", () => {
  it("reads ISO codes and Arabic symbols", () => {
    expect(normalizeFeedCurrency("EGP")).toBe("EGP");
    expect(normalizeFeedCurrency("egp")).toBe("EGP");
    expect(normalizeFeedCurrency("ج.م")).toBe("EGP");
  });

  it("falls back to a currency embedded in the price cell", () => {
    expect(normalizeFeedCurrency(null, "SAR 199.00")).toBe("SAR");
    expect(normalizeFeedCurrency(null, null)).toBeNull();
  });
});

describe("parseFeedAvailability", () => {
  it("maps common tokens", () => {
    expect(parseFeedAvailability("in stock")).toBe(true);
    expect(parseFeedAvailability("TRUE")).toBe(true);
    expect(parseFeedAvailability("OutOfStock")).toBe(false);
    expect(parseFeedAvailability("preorder")).toBe(false);
  });

  it("returns null when the feed is silent", () => {
    expect(parseFeedAvailability("")).toBeNull();
    expect(parseFeedAvailability(undefined)).toBeNull();
  });
});

describe("mapFeedRowToItem", () => {
  const ctx = { rowIndex: 1 };

  it("maps a complete row and prefers barcode identity", () => {
    const outcome = mapFeedRowToItem(
      {
        title: "Wireless Earbuds",
        barcode: "1234567890123",
        sku: "SKU-1",
        storename: "Noon",
        country: "EG",
        price: "1,299.00",
        currency: "EGP",
        affiliateurl: "https://track.example.com/a?u=1",
        producturl: "https://www.noon.com/eg/e1",
      },
      ctx,
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.item.globalSku).toBe("arabclicks:gtin:1234567890123");
    expect(outcome.item.storeName).toBe("Noon");
    expect(outcome.item.countryCode).toBe("EG");
    expect(outcome.item.price).toBe(1299);
    expect(outcome.item.productUrl).toBe("https://www.noon.com/eg/e1");
  });

  it("falls back to store-scoped SKU, then a stable hash", () => {
    const base = {
      title: "Coffee Grinder",
      storename: "Jumia",
      country: "SA",
      price: "50",
      currency: "SAR",
      affiliateurl: "https://track.example.com/a?u=9",
    };
    const withSku = mapFeedRowToItem({ ...base, sku: "SKU-9" }, ctx);
    expect(withSku.ok && withSku.item.globalSku).toBe("arabclicks:jumia:SKU-9");

    const hashed = mapFeedRowToItem(base, ctx);
    expect(hashed.ok && hashed.item.globalSku).toMatch(/^arabclicks:jumia:h:[0-9a-f]{16}$/);
    const again = mapFeedRowToItem(base, ctx);
    expect(again.ok && again.item.globalSku).toBe(hashed.ok ? hashed.item.globalSku : "");
  });

  it("rejects rows missing required real data", () => {
    expect(mapFeedRowToItem({ storename: "Noon", country: "EG" }, ctx).ok).toBe(false);
    expect(
      mapFeedRowToItem({ title: "X", country: "EG", price: "5", currency: "EGP" }, ctx).ok,
    ).toBe(false);
    expect(
      mapFeedRowToItem(
        { title: "X", storename: "Noon", price: "5", currency: "EGP", affiliateurl: "https://t/x" },
        ctx,
      ).ok,
    ).toBe(false);
    expect(
      mapFeedRowToItem(
        { title: "X", storename: "Noon", country: "EG", price: "0", affiliateurl: "https://t/x" },
        ctx,
      ).ok,
    ).toBe(false);
  });

  it("applies feed-level defaults for single-market/single-store exports", () => {
    const outcome = mapFeedRowToItem(
      { title: "Something", price: "10", affiliateurl: "https://track.example.com/a" },
      { rowIndex: 1, defaultStoreName: "Jumia", defaultCountryCode: "EG" },
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.item.storeName).toBe("Jumia");
    expect(outcome.item.countryCode).toBe("EG");
    expect(outcome.item.currency).toBe("EGP");
  });
});

// ── Streaming parsers ───────────────────────────────────────────────────

describe("CsvStreamParser", () => {
  function collect(parser: CsvStreamParser, chunks: string[]) {
    const rows: Array<Record<string, string>> = [];
    for (const chunk of chunks) rows.push(...parser.push(chunk));
    rows.push(...parser.flush());
    return rows;
  }

  it("parses quoted fields, embedded commas/newlines and CRLF", () => {
    const csv =
      'a,b\r\n"hello, world","line1\nline2"\r\n"quote""d",plain\r\n';
    const rows = collect(new CsvStreamParser(), [csv]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ a: "hello, world", b: "line1\nline2" });
    expect(rows[1]).toEqual({ a: 'quote"d', b: "plain" });
  });

  it("sniffs a non-comma delimiter", () => {
    const csv = "a;b;c\n1;2;3\n";
    const rows = collect(new CsvStreamParser(), [csv]);
    expect(rows).toEqual([{ a: "1", b: "2", c: "3" }]);
  });

  it("is chunk-boundary safe inside quotes", () => {
    const csv = 'a,b\n"he,llo",world\n';
    const rows = collect(new CsvStreamParser(), [csv.slice(0, 9), csv.slice(9, 11), csv.slice(11)]);
    expect(rows).toEqual([{ a: "he,llo", b: "world" }]);
  });

  it("keeps the first non-empty value for duplicate headers", () => {
    const csv = "title,name,price\nPrimary,Secondary,10\n";
    const rows = collect(new CsvStreamParser(), [csv]);
    expect(rows[0].title).toBe("Primary");
  });
});

describe("XmlFeedParser", () => {
  it("extracts item blocks with CDATA and namespace prefixes", () => {
    const xml =
      '<?xml version="1.0"?><rss><channel>' +
      "<g:item><title><![CDATA[My, Product]]></title><price>10</price></g:item>" +
      "<g:item><title>Second</title><price>20</price></g:item>" +
      "</channel></rss>";
    const parser = new XmlFeedParser("item");
    const rows = [
      ...parser.push(xml.slice(0, 60)),
      ...parser.push(xml.slice(60)),
      ...parser.flush(),
    ];
    expect(rows).toHaveLength(2);
    expect(rows[0].title).toBe("My, Product");
    expect(rows[0].price).toBe("10");
    expect(rows[1].title).toBe("Second");
  });

  it("extractXmlFields decodes entities and strips namespace in child tags", () => {
    const fields = extractXmlFields("<g:title>A &amp; B</g:title><n>1</n>");
    expect(fields.title).toBe("A & B");
    expect(fields.n).toBe("1");
  });
});

// ── End-to-end sync ─────────────────────────────────────────────────────

describe("syncArabClicksFeed", () => {
  it("writes the global schema with correct conflict targets and network identity", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = await startFeedServer(CSV_FEED);
    const { client, state } = createFakeSupabase();

    const result = await syncArabClicksFeed(url, { supabase: client });

    expect(result.format).toBe("csv");
    expect(result.rowsRead).toBe(5);
    expect(result.skipped).toBe(2); // broken price row + missing store row
    expect(result.failed).toBe(0);
    expect(result.productsUpserted).toBe(3);
    expect(result.offersUpserted).toBe(3);
    expect(result.stores).toEqual(["Jumia", "Noon"]);
    expect(result.countries).toEqual(["EG", "SA"]);
    expect(result.stoppedReason).toBe("done");

    for (const call of state.products) {
      expect(call.options.onConflict).toBe("global_sku");
      expect(call.row).toHaveProperty("title");
      expect(call.row).toHaveProperty("main_image");
      expect(call.row).not.toHaveProperty("name");
      expect(call.row).not.toHaveProperty("image_url");
    }
    for (const call of state.offers) {
      expect(call.options).toEqual({
        onConflict: "product_id,store_name,country_code",
        ignoreDuplicates: false,
      });
      expect(call.row.network_name).toBe(ARABCLICKS_NETWORK_NAME);
      expect(call.row).toHaveProperty("last_updated");
      expect(call.row).not.toHaveProperty("updated_at");
      expect(call.row).toHaveProperty("product_store_url");
    }
  });

  it("merges the same barcode from two stores into one product id", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = await startFeedServer(CSV_FEED);
    const { client, state } = createFakeSupabase({
      productId: (row) => `pid-${row.global_sku}`,
    });

    const result = await syncArabClicksFeed(url, { supabase: client, maxItems: 2 });

    expect(result.productsUpserted).toBe(2);
    expect(result.offersUpserted).toBe(2);
    const skus = state.products.map((c) => c.row.global_sku);
    expect(skus[0]).toBe(skus[1]);
    expect(state.offers).toHaveLength(2);
    expect(state.offers[0].row.product_id).toBe(state.offers[1].row.product_id);
  });

  it("isolates per-row write failures without aborting the run", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const url = await startFeedServer(CSV_FEED);
    let offerAttempts = 0;
    const { client } = createFakeSupabase({
      failOffer: () => {
        offerAttempts += 1;
        return offerAttempts === 2; // second valid row's offer fails
      },
    });

    const result = await syncArabClicksFeed(url, { supabase: client });

    expect(result.offersUpserted).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors.some((e) => e.includes("write failed"))).toBe(true);
    expect(result.stoppedReason).toBe("done");
  });

  it("deduplicates repeated (sku, store, country) rows", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const row = csvLine([
      "Item",
      "",
      "",
      "https://cdn.example.com/i.jpg",
      "",
      "",
      "",
      "Noon",
      "EG",
      "10",
      "EGP",
      "https://track.example.com/a",
      "",
      "true",
    ]);
    const feed = `${csvLine(CSV_HEADER)}\n${row}\n${row}\n`;
    const url = await startFeedServer(feed);
    const { client } = createFakeSupabase();

    const result = await syncArabClicksFeed(url, { supabase: client });

    expect(result.rowsRead).toBe(2);
    expect(result.duplicatesSkipped).toBe(1);
    expect(result.offersUpserted).toBe(1);
  });

  it("stops cleanly at maxItems", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const url = await startFeedServer(CSV_FEED);
    const { client } = createFakeSupabase();

    const result = await syncArabClicksFeed(url, { supabase: client, maxItems: 2 });

    expect(result.rowsRead).toBe(2);
    expect(result.stoppedReason).toBe("max-items");
  });

  it("stops at an elapsed deadline", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const url = await startFeedServer(CSV_FEED);
    const { client, state } = createFakeSupabase();

    const result = await syncArabClicksFeed(url, { supabase: client, deadlineMs: Date.now() - 1 });

    expect(result.stoppedReason).toBe("deadline");
    expect(result.rowsRead).toBe(0);
    expect(state.products).toHaveLength(0);
  });

  it("performs no writes in dry-run mode", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const url = await startFeedServer(CSV_FEED);

    const result = await syncArabClicksFeed(url, { dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.offersUpserted).toBe(3);
    expect(result.stores).toEqual(["Jumia", "Noon"]);
  });

  it("parses XML feeds via streamed chunks", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const xml =
      '<?xml version="1.0" encoding="UTF-8"?><products>' +
      "<product><title>Tee</title><store>H&M</store><country>AE</country><price>99</price><currency>AED</currency><link>https://track.example.com/a?u=1</link><sku>HM-1</sku></product>" +
      "<product><title>Mug</title><store>H&M</store><country>AE</country><price>19</price><currency>AED</currency><link>https://track.example.com/a?u=2</link><sku>HM-2</sku></product>" +
      "</products>";
    const url = await startFeedServer(xml, { contentType: "application/xml", chunkSize: 17 });
    const { client, state } = createFakeSupabase();

    const result = await syncArabClicksFeed(url, { supabase: client });

    expect(result.format).toBe("xml");
    expect(result.offersUpserted).toBe(2);
    expect(result.stores).toEqual(["H&M"]);
    expect(state.offers[0].row.affiliate_url).toBe("https://track.example.com/a?u=1");
  });

  it("rejects a non-OK feed response", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const url = await startFeedServer("nope", { status: 503 });
    const { client } = createFakeSupabase();

    await expect(syncArabClicksFeed(url, { supabase: client })).rejects.toThrow(/HTTP 503/);
  });

  it("rejects an empty feed body", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    const url = await startFeedServer("");
    const { client } = createFakeSupabase();

    await expect(syncArabClicksFeed(url, { supabase: client })).rejects.toThrow(/empty/i);
  });

  it("rejects an invalid feed URL", async () => {
    await expect(syncArabClicksFeed("not-a-url")).rejects.toThrow(/valid URL/);
  });
});
