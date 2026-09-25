import { describe, expect, it } from "vitest";
import {
  ACCESSORY_EXCLUSION_TERMS,
  DEVICE_PRICE_FLOOR_USD,
  HANDSET_PRICE_FLOOR_USD,
  belowDevicePriceFloor,
  devicePriceFloorInActiveCurrency,
  devicePriceFloorUsd,
  enforceStrictDevicePool,
  hasAccessoryTerm,
  hasHandsetAccessoryTerm,
  isHandsetQuery,
  looksLikeGenuineDevice,
  passesStrictDeviceGuard,
  priceInUsd,
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

    it("flags earphone/headphone via the handset-only matcher, not the base set", () => {
      expect(hasAccessoryTerm("Wireless earphones for Samsung")).toBe(false);
      expect(hasAccessoryTerm("Noise cancelling headphones for iPhone")).toBe(false);
      expect(hasHandsetAccessoryTerm("Wireless earphones for Samsung")).toBe(true);
      expect(hasHandsetAccessoryTerm("Noise cancelling headphones for iPhone")).toBe(true);
      expect(hasHandsetAccessoryTerm("Silicone Cases for iPhone 15")).toBe(true); // base terms still fire
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

  describe("isHandsetQuery", () => {
    it("classifies phone-family queries as handsets", () => {
      expect(isHandsetQuery("iphone 15 pro max")).toBe(true);
      expect(isHandsetQuery("samsung galaxy s24")).toBe(true);
      expect(isHandsetQuery("google pixel 8")).toBe(true);
    });

    it("keeps non-handset device queries off the handset floor", () => {
      expect(isHandsetQuery("wireless earbuds")).toBe(false);
      expect(isHandsetQuery("airpods pro")).toBe(false);
      expect(isHandsetQuery("ipad air")).toBe(false);
      expect(isHandsetQuery("macbook air m3")).toBe(false);
    });

    it("still classifies a phone-family accessory query as a handset family", () => {
      // The CALLER decides device-intent scope; isHandsetQuery only reports the
      // product family (a "case" query is phone family but never routed through
      // the guard because its intent is accessory).
      expect(isHandsetQuery("iphone 15 case")).toBe(true);
    });
  });

  describe("passesStrictDeviceGuard", () => {
    it("rejects accessory rows on handset queries (incl. earphone/headphone)", () => {
      expect(passesStrictDeviceGuard("Tpu Phone Case For iPhone X", 0.32, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("Tempered Glass Screen Protector For iPhone", 3, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("Fluffy Phone Cases Covers iPhone", 15, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("Wireless Earphones for Samsung", 39, "samsung galaxy s24")).toBe(false);
      expect(passesStrictDeviceGuard("Noise Cancelling Headphones for iPhone", 199, "iphone 15 pro max")).toBe(false);
    });

    it("keeps genuine devices above the absolute handset floor", () => {
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB Unlocked", 1200, "iphone 15 pro max")).toBe(true);
      expect(passesStrictDeviceGuard("Refurbished iPhone 12 - 128GB Factory Unlocked", 167, "iphone 15 pro")).toBe(true); // above the absolute $150 floor
      expect(passesStrictDeviceGuard("Samsung Galaxy S24 256GB", 899, "samsung galaxy s24")).toBe(true);
    });

    it("hard-drops a genuine-looking device below the absolute $150 handset floor (no genuine-carve-out)", () => {
      expect(passesStrictDeviceGuard("Apple iPhone 12 64GB Factory Unlocked", 8, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("Samsung Galaxy S24 128GB", 2, "samsung galaxy s24")).toBe(false);
      expect(passesStrictDeviceGuard("Google Pixel 8 Pro", 89, "google pixel 8")).toBe(false);
    });

    it("keeps genuine sub-$150 audio devices on non-handset queries (real earbuds are legitimate)", () => {
      expect(passesStrictDeviceGuard("Wireless Earbuds Pro Bluetooth", 24.99, "wireless earbuds")).toBe(true);
      expect(passesStrictDeviceGuard("Sony WH-1000XM5 Wireless Headphones", 129, "sony headphones")).toBe(true);
      expect(passesStrictDeviceGuard("Apple AirPods Pro 2", 89, "airpods pro")).toBe(true);
    });
  });

  describe("devicePriceFloorUsd / belowDevicePriceFloor", () => {
    it("applies the $150 absolute floor to handset queries", () => {
      expect(devicePriceFloorUsd("iphone 15 pro max")).toBe(HANDSET_PRICE_FLOOR_USD);
      expect(devicePriceFloorUsd("samsung galaxy s24")).toBe(HANDSET_PRICE_FLOOR_USD);
      expect(devicePriceFloorUsd("google pixel 8")).toBe(HANDSET_PRICE_FLOOR_USD);
      expect(belowDevicePriceFloor(149.99, "samsung galaxy s24")).toBe(true);
      expect(belowDevicePriceFloor(150, "samsung galaxy s24")).toBe(false);
      expect(belowDevicePriceFloor(149.99, "iphone 15 pro max")).toBe(true);
      expect(belowDevicePriceFloor(150, "iphone 15 pro")).toBe(false);
    });

    it("keeps the $100 floor for non-handset device queries", () => {
      expect(devicePriceFloorUsd("wireless earbuds")).toBe(DEVICE_PRICE_FLOOR_USD);
      expect(devicePriceFloorUsd("ipad air")).toBe(DEVICE_PRICE_FLOOR_USD);
      expect(belowDevicePriceFloor(99.99, "wireless earbuds")).toBe(true);
      expect(belowDevicePriceFloor(100, "wireless earbuds")).toBe(false);
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
    const belowFloorGenuine = { title: "Google Pixel 8 Pro 128GB", price: 89 };
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

    it("drops a genuine-looking device below the absolute $150 handset floor", () => {
      const kept = enforceStrictDevicePool([belowFloorGenuine], "google pixel 8");
      expect(kept).toEqual([]);
    });

    it("keeps genuine sub-$150 earbuds on a non-handset device query", () => {
      const kept = enforceStrictDevicePool(
        [
          { title: "Wireless Earbuds Pro Bluetooth 5.3", price: 24.99 },
          { title: "Silicone Case for Samsung", price: 12 },
        ],
        "wireless earbuds",
      );
      expect(kept.map((l) => l.title)).toEqual(["Wireless Earbuds Pro Bluetooth 5.3"]);
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
        "iphone 15 pro max",
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

  describe("priceInUsd / currency-aware handset floor", () => {
    it("normalises a row's own currency to USD before the floor", () => {
      // 48,484 EGP ≈ $999 (real iPhone) — keeps.
      expect(priceInUsd(48484, "EGP")).toBe(999.67);
      // 1,000 EGP ≈ $20.6 — stays below the $150 floor and must drop.
      expect(priceInUsd(1000, "EGP")).toBe(20.62);
      expect(priceInUsd(48484, "EGP")! >= HANDSET_PRICE_FLOOR_USD).toBe(true);
      expect(priceInUsd(1000, "EGP")! < HANDSET_PRICE_FLOOR_USD).toBe(true);
    });

    it("returns raw price for USD and missing currency", () => {
      expect(priceInUsd(849, "USD")).toBe(849);
      expect(priceInUsd(849)).toBe(849);
      expect(priceInUsd(849, "usd")).toBe(849);
    });

    it("returns null for an explicit unsupported currency (UAH)", () => {
      expect(priceInUsd(72000, "UAH")).toBeNull();
    });

    it("converts every supported currency through the USD pivot", () => {
      expect(priceInUsd(920, "EUR")).toBe(1000);
      expect(priceInUsd(790, "GBP")).toBe(1000);
      expect(priceInUsd(3670, "AED")).toBe(1000);
      expect(priceInUsd(1360, "CAD")).toBe(1000);
    });

    it("drops a raw-EGP-priced handset that only looks cheap as a raw digit", () => {
      // 1,000 EGP ≈ $20.6 < $150 — a genuine-looking iPhone title must still drop
      // with a concrete EGP price (the Amazon-EG seam bug this guardrail fixes).
      expect(
        passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB Unlocked", 1000, "iphone 15 pro max", "EGP"),
      ).toBe(false);
      // 8,000 EGP ≈ $164.9 ≥ $150 — genuine EGP-priced handset survives.
      expect(
        passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB Unlocked", 8000, "iphone 15 pro max", "EGP"),
      ).toBe(true);
    });

    it("keeps genuine UAH-priced handsets via the raw-price fallback", () => {
      // Explicit unsupported currency → raw numeric comparison (pre-currency
      // behaviour) so a genuine Admitad UAH handset is never dropped.
      expect(
        passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB Unlocked", 25999, "iphone 15 pro max", "UAH"),
      ).toBe(true);
      // Raw fallback still floors cheap rows the same way it always has.
      expect(
        passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB Unlocked", 120, "iphone 15 pro max", "UAH"),
      ).toBe(false);
    });

    it("expresses the floor in the visitor's ACTIVE currency (EGP mode)", () => {
      // USD floor $150 → ≈7500 EGP (static pivot 48.5): 150 * 48.5 = 7275.
      // Both sides are now compared in the number the EGP visitor sees.
      expect(devicePriceFloorInActiveCurrency("iphone 15 pro max", "EGP")).toBe(7275);
      expect(devicePriceFloorInActiveCurrency("iphone 15 pro max", "USD")).toBe(150);
      expect(devicePriceFloorInActiveCurrency("wireless earbuds", "EGP")).toBe(4850);
      expect(devicePriceFloorInActiveCurrency("wireless earbuds", "USD")).toBe(100);
    });

    it("normalises an EGP-priced row into the ACTIVE currency before the floor", () => {
      // 48,484 EGP ≈ $999 — a genuine US-equivalent price, passes in EGP mode.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 48484, "iphone 15 pro max", "EGP", "EGP")).toBe(true);
      // 1,000 EGP ≈ $20.6 — below the ≈7500 EGP floor, must drop in EGP mode.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 1000, "iphone 15 pro max", "EGP", "EGP")).toBe(false);
      // Same row in USD mode: 1,000 EGP is ≈ $20.6 < $150 — still drops.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 1000, "iphone 15 pro max", "EGP", "USD")).toBe(false);
    });

    it("is outcome-equivalent to the USD pivot but never compares raw digits cross-currency", () => {
      // 8,000 EGP ≈ $164.9 — above the $150 floor, below a (wrong) 8k-vs-USD
      // reading would also pass; the guard converts EGP→ACTIVE like-for-like.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 8000, "iphone 15 pro max", "EGP", "EGP")).toBe(true);
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 8000, "iphone 15 pro max", "EGP", "USD")).toBe(true);
      // USD-priced row seen by an EGP visitor: $120 < $150 and < 7275 EGP.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 120, "iphone 15 pro max", "USD", "EGP")).toBe(false);
      // $899 > both floors — keeps in either active currency.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 899, "iphone 15 pro max", "USD", "EGP")).toBe(true);
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 899, "iphone 15 pro max", "USD", "USD")).toBe(true);
    });

    it("uses the active floor for the unsupported-currency raw fallback", () => {
      // A UAH row compared against the EGP visitor's ≈7500 floor: the raw 4000
      // is under it, so the row drops with the ACTIVE floor — never a USD one.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 4000, "iphone 15 pro max", "UAH", "EGP")).toBe(false);
      // 40,000 raw (UAH) clears the EGP floor — keeps.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 40000, "iphone 15 pro max", "UAH", "EGP")).toBe(true);
      // Same 4000 raw against the USD floor is above $150 → keeps in USD mode.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 4000, "iphone 15 pro max", "UAH", "USD")).toBe(true);
    });
  });

  describe("must-contain brand rule", () => {
    it("hard-drops non-brand titles on a branded device query", () => {
      expect(passesStrictDeviceGuard("Wireless Bluetooth Speaker", 2099, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("Electric Scooter 350W", 299, "iphone 15 pro max")).toBe(false);
      // The exact bug: a Samsung device on an "iPhone" query is unrelated
      // sponsored inventory, never a match.
      expect(passesStrictDeviceGuard("Samsung Galaxy S25 Ultra 512GB", 899, "iphone 15 pro max")).toBe(false);
    });

    it("drops BRANDLESS cross-family Apple titles on an iphone query (leak fix)", () => {
      // The old combined rule accepted any of iphone|ipad|macbook tokens, so an
      // "iPhone" query accepted a bare "iPad Pro" or "MacBook Air" (no Apple/
      // iPhone brand anywhere). Each family is now its own hard rule: an iPhone
      // query requires iPhone/Apple (ايفون) — a brandless other-family title
      // drops, while a title that genuinely carries the Apple/iPhone brand
      // still passes per the must-contain "iPhone or Apple" contract.
      expect(passesStrictDeviceGuard("iPad Pro 12.9", 999, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("MacBook Air M3", 999, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("ايباد برو 12.9", 999, "iphone 15 pro max")).toBe(false);
      expect(passesStrictDeviceGuard("ماك بوك اير", 999, "iphone 15 pro max")).toBe(false);
      // Cross-family titles that DO carry the Apple brand are not unrelated
      // sponsored inventory — they keep the must-contain contract.
      expect(passesStrictDeviceGuard("Apple iPad Pro 11 M4", 899, "iphone 15 pro max")).toBe(true);
      expect(passesStrictDeviceGuard("Apple MacBook Air M3", 999, "iphone 15 pro max")).toBe(true);
      // ...while the genuine iPhone still passes on the same query.
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB Unlocked", 899, "iphone 15 pro max")).toBe(true);
    });

    it("drops brandless other-family titles on an ipad query (strict per-family)", () => {
      expect(passesStrictDeviceGuard("iPhone 15 Pro 128GB", 799, "ipad pro")).toBe(false);
      expect(passesStrictDeviceGuard("MacBook Air M3", 999, "ipad pro")).toBe(false);
      expect(passesStrictDeviceGuard("ايفون 15 برو", 799, "ipad pro")).toBe(false);
      expect(passesStrictDeviceGuard("Apple iPad Pro 11 M4", 899, "ipad pro")).toBe(true);
    });

    it("drops brandless other-family titles on a macbook query (strict per-family)", () => {
      expect(passesStrictDeviceGuard("iPhone 15 Pro 128GB", 799, "macbook air")).toBe(false);
      expect(passesStrictDeviceGuard("iPad Pro 12.9", 999, "macbook air")).toBe(false);
      expect(passesStrictDeviceGuard("ايفون 15 برو", 799, "macbook air")).toBe(false);
      expect(passesStrictDeviceGuard("Apple MacBook Air M3", 999, "macbook air")).toBe(true);
    });

    it("keeps titles that carry any required brand alias (Latin, case-insensitive)", () => {
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB Unlocked", 899, "iphone 15 pro max")).toBe(true);
      expect(passesStrictDeviceGuard("iPhone 15 Pro 128GB", 799, "iphone")).toBe(true);
      expect(passesStrictDeviceGuard("Smartphone Dual SIM 5G", 299, "smartphone")).toBe(true);
    });

    it("covers every branded family", () => {
      expect(passesStrictDeviceGuard("Apple iPad Pro 11 M4", 899, "ipad pro")).toBe(true);
      expect(passesStrictDeviceGuard("Logitech Keyboard", 89, "ipad pro")).toBe(false);
      expect(passesStrictDeviceGuard("Apple MacBook Air M3", 999, "macbook air")).toBe(true);
      expect(passesStrictDeviceGuard("Samsung Galaxy S24 Ultra", 899, "samsung galaxy s24")).toBe(true);
      expect(passesStrictDeviceGuard("Xiaomi 14 Pro", 499, "xiaomi 14")).toBe(true);
      expect(passesStrictDeviceGuard("Redmi Note 13", 199, "xiaomi redmi")).toBe(true);
      expect(passesStrictDeviceGuard("Google Pixel 9 Pro", 799, "pixel 9")).toBe(true);
      expect(passesStrictDeviceGuard("OnePlus 12 256GB", 599, "oneplus 12")).toBe(true);
      expect(passesStrictDeviceGuard("Sony PlayStation 5 Console", 449, "ps5")).toBe(true);
      expect(passesStrictDeviceGuard("NVIDIA GeForce RTX 5090", 1999, "rtx 5090")).toBe(true);
    });

    it("matches Arabic aliases both ways (Latin query ↔ Arabic title and reverse)", () => {
      expect(passesStrictDeviceGuard("ايفون 15 برو ماكس 256 جيجا هاتف", 849, "iphone 15 pro max")).toBe(true);
      expect(passesStrictDeviceGuard("Apple iPhone 15 Pro Max 256GB", 849, "ايفون 15 برو ماكس")).toBe(true);
      expect(passesStrictDeviceGuard("سامسونج جالكسي S24 الترا", 750, "سامسونج جالكسي")).toBe(true);
      expect(passesStrictDeviceGuard("Samsung Galaxy S24 Ultra", 750, "سامسونج جالكسي")).toBe(true);
      expect(passesStrictDeviceGuard("شاومي 13 برو", 450, "شاومي 13")).toBe(true);
    });

    it("leaves unbranded device queries untouched", () => {
      expect(passesStrictDeviceGuard("Wireless Earbuds Pro", 29, "wireless earbuds")).toBe(true);
      expect(passesStrictDeviceGuard("Wireless Noise Cancelling Headphones Over Ear", 129, "bluetooth headphones")).toBe(true);
      expect(passesStrictDeviceGuard("Any Random Product", 899, "smartphone")).toBe(true);
    });
  });
});