import { afterEach, describe, expect, it } from "vitest";
import {
  createNoonProvider,
} from "@/lib/sync/providers/amazon/noon";
import {
  getProviderAdapter as getSyncProviderAdapter,
  isSyncProviderCapable,
} from "@/lib/sync/providers";
import { createSyncBridgeConnector } from "@/lib/search/connectors/sync-bridge";
import { getActiveProviderAdapters } from "@/lib/providers/adapter-registry";

const PLACEHOLDER_IMPORT_IDS = ["walmart", "temu", "bestbuy", "noon", "jumia"] as const;

/**
 * Run fn with a credential env var set, then always restore the environment.
 * Credentials are dynamically read (checkProviderCredentials), so this simulates
 * "provider configured" without touching Vercel or a real secret.
 */
async function withCredential(envKey: string, fn: () => Promise<void>): Promise<void> {
  process.env[envKey] = "test-credential";
  try {
    await fn();
  } finally {
    delete process.env[envKey];
  }
}

afterEach(() => {
  delete process.env.WALMART_API_KEY;
  delete process.env.TEMU_API_KEY;
  delete process.env.BESTBUY_API_KEY;
  delete process.env.NOON_API_KEY;
  delete process.env.JUMIA_API_KEY;
});

// ─── Sync-layer adapter resolution ──────────────────────────────────────────

describe("sync-layer getProviderAdapter", () => {
  it("throws for unknown providers instead of silently aliasing them", () => {
    expect(() => getSyncProviderAdapter("nonexistent")).toThrow();
    // amazon-eg is NOT an import provider — it must never resolve through the
    // sync provider layer (no silent redirect to another adapter).
    expect(() => getSyncProviderAdapter("amazon-eg")).toThrow();
  });

  it("resolves every registered import provider to its own adapter", () => {
    for (const id of [...PLACEHOLDER_IMPORT_IDS, "aliexpress", "ebay", "cjdropshipping", "amazon"]) {
      const adapter = getSyncProviderAdapter(id);
      expect(adapter.id, id).toBe(id);
    }
  });
});

// ─── Capability gate ────────────────────────────────────────────────────────

describe("isSyncProviderCapable", () => {
  it("false for every placeholder adapter (cannot produce real products)", () => {
    for (const id of PLACEHOLDER_IMPORT_IDS) {
      expect(isSyncProviderCapable(id), id).toBe(false);
    }
  });

  it("true for live adapters (real client path exists)", () => {
    for (const id of ["aliexpress", "ebay", "cjdropshipping", "amazon"]) {
      expect(isSyncProviderCapable(id), id).toBe(true);
    }
  });

  it("false for unknown adapters", () => {
    expect(isSyncProviderCapable("nonexistent")).toBe(false);
  });

  it("Noon is labeled placeholder (it was mislabeled 'live' while returning [])", () => {
    expect(createNoonProvider().meta.phase).toBe("placeholder");
  });
});

// ─── Sync-bridge availability (phantom-source defense) ──────────────────────

describe("sync-bridge availability", () => {
  it("placeholder connectors are unavailable with no credentials", async () => {
    const connector = createSyncBridgeConnector({
      id: "walmart",
      name: "Walmart",
      importId: "walmart",
      productionId: "walmart",
    });
    expect(await connector.isAvailable()).toBe(false);
  });

  it("placeholder connectors stay unavailable EVEN when credentials are set", async () => {
    await withCredential("WALMART_API_KEY", async () => {
      const connector = createSyncBridgeConnector({
        id: "walmart",
        name: "Walmart",
        importId: "walmart",
        productionId: "walmart",
      });
      expect(await connector.isAvailable()).toBe(false);
    });
  });

  it("search returns [] without invoking the placeholder adapter", async () => {
    await withCredential("WALMART_API_KEY", async () => {
      const connector = createSyncBridgeConnector({
        id: "walmart",
        name: "Walmart",
        importId: "walmart",
        productionId: "walmart",
      });
      const results = await connector.search("shoes");
      expect(results).toEqual([]);
    });
  });

  it("getActiveProviderAdapters excludes configured-but-incapable placeholders", async () => {
    await withCredential("WALMART_API_KEY", async () => {
      const active = await getActiveProviderAdapters(["walmart"]);
      expect(active).toEqual([]);
    });
  });
});