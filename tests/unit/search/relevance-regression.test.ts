import { describe, expect, it } from "vitest";
import {
  analyzeSearchListing,
  hasSameSeries,
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

  it("never treats a bare 'galaxy phones' marketing echo as a genuine Galaxy device (live S-Phone knockoff)", () => {
    const query = "samsung galaxy s24";
    const knockoff =
      "S-Phone S6 Edge 2018 Hot Sale Brand newest galaxy phones Original Unlocked refurbished Mobile Used Smart Phone";
    const analysis = analyzeSearchListing(knockoff, query);
    expect(analysis.tier).toBe("none");
    expect(analysis.isDevice).toBe(false);
    // Bare "galaxy phones" is marketing wording, not a same-series anchor.
    expect(hasSameSeries(knockoff, query)).toBe(false);
  });

  it("keeps genuine Galaxy devices same-series (S22+, A55, Note20) for a galaxy s24 query", () => {
    const query = "samsung galaxy s24";
    const genuine = [
      "Samsung Galaxy S22+ 5G Network Unlocked Mobile Phone Smartphone",
      "Samsung Galaxy A55 5G 128GB Unlocked Android Smartphone",
      "SAMSUNG Galaxy Note20 5G Factory Unlocked 128GB",
    ];
    for (const title of genuine) {
      const analysis = analyzeSearchListing(title, query);
      expect(hasSameSeries(title, query)).toBe(true);
      expect(analysis.tier).toBe("series");
      expect(analysis.isDevice).toBe(true);
    }
  });
});