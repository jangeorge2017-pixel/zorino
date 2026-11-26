import { describe, expect, it } from "vitest";
import {
  analyzeSearchListing,
  analyzeStrictIntent,
  hasSameSeries,
  isAccessoryListing,
  looksLikeDevice,
  strictTitleState,
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

describe("relevance — strict compound and accessory intent", () => {
  it("accepts only washing-machine titles and rejects coffee/espresso/sewing machines", () => {
    const intent = analyzeStrictIntent("غسالة");
    expect(intent?.kind).toBe("washing-machine");
    expect(
      strictTitleState("Samsung Front Load Washing Machine 9KG", intent!),
    ).toBe("tier1");
    for (const title of [
      "DeLonghi Espresso Machine",
      "Nespresso Coffee Machine",
      "Singer Sewing Machine",
      "Generic Machine",
      "Front Automatic Washing Machine Cover Tarpaulin",
    ]) {
      expect(strictTitleState(title, intent!)).toBe("rejected");
    }
  });

  it("rejects accessory-style titles for appliance queries", () => {
    const microwave = analyzeStrictIntent("مايكرويف")!;
    const refrigerator = analyzeStrictIntent("ثلاجة")!;
    expect(
      strictTitleState("Portable Plastic Microwave Egg Steamer", microwave),
    ).toBe("rejected");
    expect(
      strictTitleState(
        "Totoro Anime Resin Fridge Magnet Sticker",
        refrigerator,
      ),
    ).toBe("rejected");
  });

  it("requires an accessory term beside the Samsung Note model", () => {
    const intent = analyzeStrictIntent("جراب سامسونج نوت");
    expect(intent?.kind).toBe("accessory-device");
    expect(
      strictTitleState("Samsung Galaxy Note20 Silicone Case", intent!),
    ).toBe("tier1");
    expect(
      strictTitleState("Samsung Galaxy Note20 5G 128GB Smartphone", intent!),
    ).toBe("rejected");
    expect(strictTitleState("iPhone 15 Pro Case", intent!)).toBe("rejected");
  });

  it("accepts Arabic and English appliance aliases without translator changes", () => {
    expect(analyzeStrictIntent("مايكرويف")?.kind).toBe("microwave");
    expect(analyzeStrictIntent("ثلاجة")?.kind).toBe("refrigerator");
    expect(
      strictTitleState(
        "Sharp microwave oven - 562ctst",
        analyzeStrictIntent("مايكرويف")!,
      ),
    ).toBe("tier1");
  });
});