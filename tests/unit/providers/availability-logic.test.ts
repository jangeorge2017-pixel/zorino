import { afterEach, describe, expect, it } from "vitest";
import {
  createNoonProvider,
} from "@/lib/sync/providers/amazon/noon";
import {
  getProviderAdapter as getSyncProviderAdapter,
  isSyncProviderCapable,
} from "@/lib/sync/providers";
import { createAmazonProvider } from "@/lib/sync/providers/amazon";
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

// ─── Phase 5: Amazon / amazon-eg are INDIRECT (latent direct isolated) ──────
// The only approved Amazon acquisition path is the indirect affiliate/network
// URL → host-guarded ASIN → ingestion path. The LATENT DIRECT path
// (query → Creators API / Oxylabs) must never activate merely because
// credentials are added later — it requires the explicit AMAZON_DIRECT_ENABLE=1
// architecture opt-in.

describe("Amazon INDIRECT gate (Phase 5 decision)", () => {
  afterEach(() => {
    delete process.env.AMAZON_CREATORS_CLIENT_ID;
    delete process.env.AMAZON_CREATORS_CLIENT_SECRET;
    delete process.env.AMAZON_DIRECT_ENABLE;
  });

  const withAmazonCreds = async (fn: () => Promise<void>): Promise<void> => {
    await withCredential("AMAZON_CREATORS_CLIENT_ID", async () => {
      await withCredential("AMAZON_CREATORS_CLIENT_SECRET", fn);
    });
  };

  it("no Amazon adapter activates with credentials ALONE (AMAZON_DIRECT_ENABLE unset)", async () => {
    await withAmazonCreds(async () => {
      const active = await getActiveProviderAdapters(["amazon", "amazon-eg"]);
      expect(active).toEqual([]);
      expect(createAmazonProvider().isConfigured()).toBe(false);
    });
  });

  it("Amazon adapters activate ONLY with the explicit AMAZON_DIRECT_ENABLE=1 opt-in", async () => {
    await withAmazonCreds(async () => {
      process.env.AMAZON_DIRECT_ENABLE = "1";
      const active = await getActiveProviderAdapters(["amazon", "amazon-eg"]);
      const ids = active.map((a) => a.id).sort();
      expect(ids).toEqual(["amazon", "amazon-eg"]);
      expect(createAmazonProvider().isConfigured()).toBe(true);
    });
  });
});