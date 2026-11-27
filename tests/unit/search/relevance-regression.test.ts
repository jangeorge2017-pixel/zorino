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

describe("relevance — universal strict product intents", () => {
  it("rejects cooker covers and accepts real cookers", () => {
    const intent = analyzeStrictIntent("بوتجاز")!;
    expect(intent.kind).toBe("cooker");
    expect(strictTitleState("Gas Cooker 4 Burners Stainless Steel", intent)).toBe("tier1");
    expect(strictTitleState("Gas Cooker Cover Waterproof", intent)).toBe("rejected");
  });

  it("accepts split AC titles and rejects AC remote covers", () => {
    const intent = analyzeStrictIntent("تكييف")!;
    expect(intent.kind).toBe("air-conditioner");
    expect(strictTitleState("Split Inverter AC 1.5 Ton", intent)).toBe("tier1");
    expect(strictTitleState("AC Remote Cover Protective Case", intent)).toBe("rejected");
  });

  it("keeps only genuine vacuum, blender, iron and perfume products", () => {
    const vacuum = analyzeStrictIntent("مكنسة")!;
    const blender = analyzeStrictIntent("خلاط")!;
    const iron = analyzeStrictIntent("مكواة")!;
    const perfume = analyzeStrictIntent("برفان")!;
    expect(strictTitleState("Dyson Vacuum Cleaner V12", vacuum)).toBe("tier1");
    expect(strictTitleState("Vacuum Cleaner Dust Bag", vacuum)).toBe("rejected");
    expect(strictTitleState("800W Blender 1.5L Jar", blender)).toBe("tier1");
    expect(strictTitleState("Blender Jar Replacement", blender)).toBe("rejected");
    expect(strictTitleState("Steam Iron 2400W", iron)).toBe("tier1");
    expect(strictTitleState("Ironing Board Cover", iron)).toBe("rejected");
    expect(strictTitleState("Perfume Eau De Parfum 100ml", perfume)).toBe("tier1");
    expect(strictTitleState("Perfume Sample Decant 5ml", perfume)).toBe("rejected");
  });

  it("handles screen protectors, chargers and headphones as real product intents", () => {
    const protector = analyzeStrictIntent("اسكرينه")!;
    const charger = analyzeStrictIntent("شاحن")!;
    const headphones = analyzeStrictIntent("سماعات")!;
    expect(protector.kind).toBe("screen-protector");
    expect(charger.kind).toBe("charger");
    expect(headphones.kind).toBe("headphones");
    expect(strictTitleState("Tempered Glass Screen Protector", protector)).toBe("tier1");
    expect(strictTitleState("Camera Protector Case for Samsung", protector)).toBe("rejected");
    expect(strictTitleState("Gas Stove 75 cm Tempered Glass", protector)).toBe("rejected");
    expect(strictTitleState("iPhone 15 Pro", protector)).toBe("rejected");
    expect(strictTitleState("65W USB C Fast Charger", charger)).toBe("tier1");
    expect(strictTitleState("iPhone 15 Pro", charger)).toBe("rejected");
    expect(strictTitleState("Wireless Headphones Noise Cancelling", headphones)).toBe("tier1");
    expect(strictTitleState("Headphone Case Cover", headphones)).toBe("rejected");
  });
});