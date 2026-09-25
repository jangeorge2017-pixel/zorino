import { describe, expect, it } from "vitest";
import {
  ACCESSORY_EXCLUSION_TERMS,
  DEVICE_PRICE_FLOOR_USD,
  IPHONE_PRICE_FLOOR_USD,
  belowDevicePriceFloor,
  devicePriceFloorUsd,
  enforceStrictDevicePool,
  hasAccessoryTerm,
  looksLikeGenuineDevice,
  passesStrictDeviceGuard,
} from "@/lib/search/accessory-exclusion";

describe("accessory-exclusion / strict device-pool guard", () => {
  describe("hasAccessoryTerm", () => {
    it("flags every exclusion term by name", () => {
      for (const term of ACCESSORY_EXCLUSION_TERMS) {
        expect(hasAccessoryTerm(`Silicone ${term} for iPhone 15 Pro`)).toBe(true);
      }
    });

    it("flags plural forms of every term (s / es / ies)", () => {
      const plurals = [
        "Silicone cases for iPhone 15",
        "Phone Covers Samsung",
        "Tempered glass screen protectors",
        "Fast chargers 20W",
        "Braided cables USB-C",
        "Calligraphy straps for Apple Watch",
        "Camera lenses for iPhone 15 Pro",
        "UV screen films for S24",
        "Magnetic phone holders",
        "Car mounts for iPhone",
        "Aluminum stands for tablet",
        "Wall brackets for TV",
        "Phone docks charging",
        "Plastic cradles for watch",
        "Styluses for iPad",
        "VR headsets for phone",
        "Display dummies iPhone",
        "Reading glasses for phone users",
      ];
      for (const title of plurals) {
        expect(hasAccessoryTerm(title)).toBe(true);
      }
    });

    it("is case-insensitive and word-boundary safe", () => {
      expect(hasAccessoryTerm("TEMPERED GLASS Samsung S24")).toBe(true);
      expect(hasAccessoryTerm("Galaxy S24 CASE")).toBe(true);
      expect(hasAccessoryTerm("iphone case")).toBe(true);
      // "case" must not match "Casetify", "lens" inside "cleans" etc.
      expect(hasAccessoryTerm("Casetify Bayside Samsung case")).toBe(true); // "case" is present regardless
      expect(hasAccessoryTerm("Casetify Bayside Samsung")).toBe(false);
      expect(hasAccessoryTerm("iPhone casing replacement")).toBe(false); // "casings" not an accessory signal
    });

    it("does not fire on genuine device wording", () => {
      expect(hasAccessoryTerm("Apple iPhone 15 Pro Max 256GB Unlocked")).toBe(false);
      expect(hasAccessoryTerm("Samsung Galaxy S24 Ultra 5G 512GB")).toBe(false);
      expect(hasAccessoryTerm("iPhone 15 Pro Dual SIM")).toBe(false);
    });
  });

  describe("passesStrictDeviceGuard", () => {
    it("rejects accessory rows and below-floor non-device rows", () => {
      expect(passesStrictDeviceGuard("Tpu Phone Case For iPhone X", 0.32, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("Tempered Glass Screen Protector For iPhone", 3, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("Fluffy Phone Cases Covers iPhone", 15, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("Wireless Mini Speaker", 29, "samsung galaxy s24")).toBe(false);
    });

    it("keeps genuine devices and above-floor rows", () => {
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB Unlocked", 1200, "iphone 15 pro max")).toBe(true);
      expect(passesStrictDeviceGuard("Refurbished iPhone 12 - 128GB Factory Unlocked", 167, "iphone 15 pro")).toBe(true); // genuine below floor
      expect(passesStrictDeviceGuard("Samsung Galaxy S24 256GB", 899, "samsung galaxy s24")).toBe(true);
    });
  });

  describe("devicePriceFloorUsd / belowDevicePriceFloor", () => {
    it("applies the $100 base floor to generic device queries", () => {
      expect(devicePriceFloorUsd("samsung galaxy s24")).toBe(DEVICE_PRICE_FLOOR_USD);
      expect(belowDevicePriceFloor(99.99, "samsung galaxy s24")).toBe(true);
      expect(belowDevicePriceFloor(100, "samsung galaxy s24")).toBe(false);
    });

    it("applies the $200 floor to iPhone-named queries", () => {
      expect(devicePriceFloorUsd("iphone 15 pro max")).toBe(IPHONE_PRICE_FLOOR_USD);
      expect(belowDevicePriceFloor(199.99, "iphone 15 pro max")).toBe(true);
      expect(belowDevicePriceFloor(200, "iphone 15 pro")).toBe(false);
    });
  });

  describe("looksLikeGenuineDevice", () => {
    it("recognises real devices", () => {
      expect(looksLikeGenuineDevice("Apple iPhone 15 Pro Max 256GB Unlocked")).toBe(true);
      expect(looksLikeGenuineDevice("Samsung Galaxy S24 Ultra 5G")).toBe(true);
      expect(looksLikeGenuineDevice("MacBook Pro 14 M3")).toBe(true);
      expect(looksLikeGenuineDevice("iPad Air 11 M2")).toBe(true);
    });

    it("rejects anything with an accessory word even if it names the device", () => {
      expect(looksLikeGenuineDevice("Tempered Glass for iPhone 15 Pro")).toBe(false);
      expect(looksLikeGenuineDevice("Silicone Case for Samsung S24")).toBe(false);
      expect(looksLikeGenuineDevice("Charging Cable iPhone USB-C")).toBe(false);
    });
  });

  describe("enforceStrictDevicePool", () => {
    const genuine = { title: "Apple iPhone 15 Pro Max 256GB Unlocked", price: 999 };
    const cheapRefurb = { title: "Apple iPhone 12 128GB Factory Unlocked", price: 167 };
    const cheapNonDevice = { title: "Wireless Mini Speaker Bluetooth", price: 29 };
    const glass = { title: "Tempered Glass Screen Protector for iPhone 15 Pro", price: 26 };
    const case_ = { title: "Silicone Case for Samsung Galaxy S24", price: 259 };
    const dummy = { title: "iPhone 15 Pro Dummy Display Model", price: 11 };

    it("keeps genuine devices and drops accessories absolutely", () => {
      const kept = enforceStrictDevicePool(
        [genuine, glass, case_, cheapRefurb, dummy],
        "iphone 15 pro max",
      );
      expect(kept.map((l) => l.title)).toEqual([
        genuine.title,
        cheapRefurb.title,
      ]);
    });

    it("keeps a genuine device below the floor (Bug1/Bug4 relevance)", () => {
      const kept = enforceStrictDevicePool([cheapRefurb], "iphone 15 pro");
      expect(kept).toEqual([cheapRefurb]);
    });

    it("is a pure filter — scope (device-intent only) lives with the caller", () => {
      // The guard always drops accessory rows; the caller decides whether a
      // query is device-intent before invoking it, so an accessory query like
      // "iphone 15 pro case" never routes through this guard in production.
      const kept = enforceStrictDevicePool([case_, glass], "iphone 15 pro max");
      expect(kept.length).toBe(0);
    });

    it("drops cheap non-genuine items under the floor", () => {
      const kept = enforceStrictDevicePool(
        [cheapNonDevice, genuine],
        "samsung galaxy s24",
      );
      expect(kept.map((l) => l.title)).toEqual([genuine.title]);
    });

    it("drops plural-form accessory titles (live leak: Fluffy Phone Cases)", () => {
      const kept = enforceStrictDevicePool(
        [
          genuine,
          { title: "Cute Rabbit Design Fluffy Phone Cases for iPhone", price: 15 },
          { title: "Nice Covers for Samsung Phone", price: 9 },
        ],
        "iphone 15 pro max",
      );
      expect(kept.map((l) => l.title)).toEqual([genuine.title]);
    });

    it("drops accessory DB-supplement rows (Alibaba WW leak) by name+price", () => {
      const kept = enforceStrictDevicePool(
        [
          genuine,
          { title: "1.5MM Solid Color Soft Matte Tpu Phone Case For Iphone X", price: 0.32 },
          { title: "0.3MM 2.5D Tempered Glass Screen Protector For iPhone X/Xs", price: 3 },
          { title: "15 Grids Side Open Jewelry Organizer Storage Box", price: 0.25 },
          { title: "High Waist Leggings Women", price: 1.15 },
        ],
        "iphone 15 pro max",
      );
      expect(kept.map((l) => l.title)).toEqual([genuine.title]);
    });
  });
});