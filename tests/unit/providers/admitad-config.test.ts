import { describe, it, expect, afterEach } from "vitest";
import {
  admitadCredentialsConfigured,
  initializeMultiMerchantDiscovery,
  getAllAdmitadFeeds,
} from "@/lib/integrations/admitad/config";

const CRED_KEYS = ["ADMITAD_CLIENT_ID", "ADMITAD_CLIENT_SECRET"] as const;

function saveEnv() {
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

describe("admitad config credential gate", () => {
  const saved = saveEnv();
  afterEach(() => restore(saved));

  it("admitadCredentialsConfigured() is false when credentials are missing", () => {
    clearCreds();
    expect(admitadCredentialsConfigured()).toBe(false);
  });

  it("admitadCredentialsConfigured() is true when both credentials are set", () => {
    process.env.ADMITAD_CLIENT_ID = "test-id";
    process.env.ADMITAD_CLIENT_SECRET = "test-secret";
    expect(admitadCredentialsConfigured()).toBe(true);
  });

  it("requires BOTH credentials (partial is not configured)", () => {
    clearCreds();
    process.env.ADMITAD_CLIENT_ID = "test-id";
    expect(admitadCredentialsConfigured()).toBe(false);
  });

  it("initializeMultiMerchantDiscovery() settles without throwing when credentials are absent", async () => {
    clearCreds();
    await expect(initializeMultiMerchantDiscovery()).resolves.toBeUndefined();
  });

  it("getAllAdmitadFeeds() returns empty (never throws) when discovery is unconfigured", async () => {
    clearCreds();
    const feeds = await getAllAdmitadFeeds();
    expect(Array.isArray(feeds)).toBe(true);
    expect(feeds.length).toBe(0);
  });
});