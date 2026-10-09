/**
 * Accessory-exclusion normalization + term coverage
 * (lib/search/accessory-exclusion.ts). Locks the strengthened surface: titles
 * are canonicalized (dash→space, NFC, Arabic fold, noise stripped) BEFORE the
 * word-boundary accessory regexes run, phrase terms pluralize their last word,
 * and brand-like words ("Casetify") are never hit by "case".
 */
import { describe, expect, it } from "vitest";
import {
  hasAccessoryTerm,
  hasHandsetAccessoryTerm,
  looksLikeGenuineDevice,
} from "@/lib/search/accessory-exclusion";

describe("accessory-exclusion: normalized surface", () => {
  it("dash-compound titles die like clean spellings", () => {
    expect(hasAccessoryTerm("Tempered-Glass-for-iPhone 15")).toBe(true);
    expect(hasAccessoryTerm("PRO-CASE for Samsung Galaxy S24")).toBe(true);
    expect(hasAccessoryTerm("Screen-Protector iPhone 15 Pro")).toBe(true);
  });

  it("uppercase and punctuation never escape", () => {
    expect(hasAccessoryTerm("ORIGINAL SILICONE CASE")).toBe(true);
    expect(hasHandsetAccessoryTerm("Pair of Headphones")).toBe(true);
  });

  it("Arabic titles are matched on their folded surface", () => {
    expect(hasAccessoryTerm("زجاج-مقوي-لايفون-15")).toBe(true);
  });
});

describe("accessory-exclusion: new term coverage", () => {
  it("expanded accessory vocabulary is word-bounded", () => {
    for (const title of [
      "MagSafe Wallet Case for iPhone 15",
      "Clear Case Samsung S24",
      "Flip Cover Galaxy S24",
      "Hydrogel Film iPhone 15",
      "UV Glass Screen Guard",
      "Kickstand Holder for iPhone",
      "Privacy Screen iPhone",
      "Selfie Stick with Ring Light",
      "Sim Card Tray for Samsung",
    ]) {
      expect(hasAccessoryTerm(title)).toBe(true);
    }
  });

  it("phrase terms pluralize their last word", () => {
    expect(hasAccessoryTerm("Wallet Cases for iPhone 15")).toBe(true);
    expect(hasAccessoryTerm("Power Banks Fast Charging")).toBe(true);
    expect(hasAccessoryTerm("Game Controllers Bluetooth")).toBe(true);
    expect(hasAccessoryTerm("Mouse Pads Desk Large")).toBe(true);
  });

  it("single-word plurals still match", () => {
    expect(hasAccessoryTerm("Dummies for iPhone")).toBe(true);
    expect(hasAccessoryTerm("Glasses Replacement")).toBe(true);
  });

  it("brand-like words are never caught by short accessory terms", () => {
    expect(hasAccessoryTerm("Casetify designer case")).toBe(true);
    expect(hasAccessoryTerm("Casetify PopGrip")).toBe(false);
    expect(hasAccessoryTerm("Casio watch band")).toBe(false);
  });
});

describe("accessory-exclusion: genuine devices survive", () => {
  it("real devices carry no accessory term", () => {
    expect(hasAccessoryTerm("Apple iPhone 15 Pro Max 256GB")).toBe(false);
    expect(hasAccessoryTerm("Samsung Galaxy S24 Ultra 1TB Unlocked")).toBe(false);
    expect(looksLikeGenuineDevice("iPhone 15 Pro 256GB Titanium")).toBe(true);
  });

  it("renamed accessories are never genuine devices", () => {
    expect(looksLikeGenuineDevice("Tempered-Glass-for-iPhone 15")).toBe(false);
    expect(looksLikeGenuineDevice("iPhone 15 Pro Wallet Case")).toBe(false);
  });
});