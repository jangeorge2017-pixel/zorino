import { describe, it, expect, afterEach } from "vitest";
import {
  ArabClicksClient,
  getArabClicksCredentialStatus,
  getArabClicksTargets,
  isArabClicksConfigured,
  isArabClicksEndpointConfigured,
  runArabClicksIngestion,
} from "@/lib/integration/arabclicks";

const CRED_KEYS = ["ARABCLICKS_API_KEY", "ARABCLICKS_PUBLISHER_ID"] as const;

function saveEnv(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const k of CRED_KEYS) saved[k] = process.env[k];
  return saved;
}
function clearCreds() {
  for (const k of CRED_KEYS) delete process.env[k];
}
function restore(saved: Record<string, string | undefined>) {
  for (const k of CRED_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

describe("ArabClicks router gating", () => {
  const saved = saveEnv();
  afterEach(() => restore(saved));

  it("routes Noon + Jumia offers", () => {
    expect(getArabClicksTargets()).toEqual(["noon", "jumia"]);
  });

  it("is not configured when credentials are missing", () => {
    clearCreds();
    expect(isArabClicksConfigured()).toBe(false);
    const status = getArabClicksCredentialStatus();
    expect(status.configured).toBe(false);
    expect(status.hasApiKey).toBe(false);
    expect(status.hasPublisherId).toBe(false);
  });

  it("requires BOTH credentials (partial is not configured)", () => {
    clearCreds();
    process.env.ARABCLICKS_API_KEY = "test-key";
    expect(isArabClicksConfigured()).toBe(false);
    process.env.ARABCLICKS_PUBLISHER_ID = "test-publisher";
    expect(isArabClicksConfigured()).toBe(true);
  });

  it("skips with not-configured and never sweeps when credentials are absent", async () => {
    clearCreds();
    const result = await runArabClicksIngestion();
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("not-configured");
    expect(result.targetsRun).toBe(0);
    expect(result.productsSaved).toBe(0);
  });

  it.skipIf(isArabClicksEndpointConfigured())(
    "skips with no-api-endpoint when creds exist but no feed endpoint is set",
    async () => {
      process.env.ARABCLICKS_API_KEY = "test-key";
      process.env.ARABCLICKS_PUBLISHER_ID = "test-publisher";
      expect(isArabClicksConfigured()).toBe(true);
      const result = await runArabClicksIngestion();
      expect(result.skipped).toBe(true);
      expect(result.reason).toBe("no-api-endpoint");
      expect(result.targetsRun).toBe(0);
    },
  );

  it("client returns [] (never throws) without a configured endpoint", async () => {
    const client = new ArabClicksClient({
      apiKey: "k",
      publisherId: "p",
      apiBase: "",
      endpoint: "",
    });
    const raws = await client.searchProducts("headphones", {
      countryCode: "EG",
      currency: "EGP",
      locale: "egypt-en",
    });
    expect(raws).toEqual([]);
  });
});
