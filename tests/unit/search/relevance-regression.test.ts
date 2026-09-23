import { describe, expect, it } from "vitest";
import {
  analyzeSearchListing,
  isAccessoryListing,
  looksLikeDevice,
} from "@/lib/search/relevance";

describe("relevance — genuine devices vs compatibility accessories (live page-1 leak regression)", () => {
  it("treats a MacBook Pro Docking Station (with MacBook Air M3 compat wording) as an accessory, not a device", () => {
    const title =
      "PULWTOP MacBook Pro Docking Station Dual Monitor with 2 HDMI 4K60Hz, USB A/C 10Gbps, PD, Ethernet, with MacBook Pro Air M3 M4 M5";
    const query = "macbook air m3";
    const analysis = analyzeSearchListing(title, query);
    expect(looksLikeDevice(title)).toBe(false);
    expect(isAccessoryListing(title, query)).toBe(true);
    expect(analysis.tier).toBe("accessory");
    expect(analysis.isDevice).toBe(false);
  });

  it("keeps a real MacBook Air M3 laptop a genuine device", () => {
    const title = "Apple MacBook Air M3 (2024) 13-inch 512GB Laptop Original";
    const query = "macbook air m3";
    const analysis = analyzeSearchListing(title, query);
    expect(isAccessoryListing(title, query)).toBe(false);
    expect(analysis.tier).toBe("exact");
    expect(analysis.isDevice).toBe(true);
  });
});