import { describe, expect, it } from "vitest";

import {
  expandArabicSearchQuery,
  getArabicSearchExpansionSync,
  normalizeArabicSearch,
} from "@/lib/search/arabic-search-dictionary";
import { buildIndexedSearchOrFilter } from "@/lib/integration/word-match-filter";
import { translateSearchQuery } from "@/lib/search/query-translation";

describe("universal Arabic search expansion", () => {
  it("folds Arabic orthography and the definite article", () => {
    expect(normalizeArabicSearch("الْغَسَّالَة")).toBe("غساله");
    expect(normalizeArabicSearch("المايكرويف")).toBe("مايكرويف");
  });

  it("expands common Arabic product queries without a translator", () => {
    expect(getArabicSearchExpansionSync("الثلاجة").english).toContain("refrigerator");
    expect(getArabicSearchExpansionSync("بوتجاز").english).toContain("cooker");
    expect(getArabicSearchExpansionSync("اسكرينه").english).toContain("screen protector");
    expect(getArabicSearchExpansionSync("سماعات").english).toContain("headphones");
  });

  it("adds dictionary tokens to the indexed product-name filter", () => {
    const filter = buildIndexedSearchOrFilter("غسالة");
    expect(filter).toContain('product_name.ilike."%غساله%"');
    expect(filter).toContain('product_name.ilike."%washing%"');
    expect(filter).toContain('product_name.ilike."%machine%"');
  });

  it("keeps an Arabic query searchable even when the external translator fails", async () => {
    const translation = await translateSearchQuery("مايكرويف");
    expect(translation.wasTranslated).toBe(true);
    expect(translation.translatedQuery.toLowerCase()).toContain("microwave");
  });

  it("uses a bounded dynamic fallback for unknown Arabic tokens", async () => {
    const expansion = await expandArabicSearchQuery("برغوست", {
      allowDynamicTranslation: true,
    });
    expect(expansion.english.length).toBeGreaterThan(0);
  });
});
