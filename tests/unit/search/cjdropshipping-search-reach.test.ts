/**
 * CJdropshipping search reach tests.
 *
 * Root cause: CJ's `/product/list` matches `productNameEn` as a SUBSTRING of
 * product titles, so a full compound phrase ("iPhone 15 Pro Max", "MacBook
 * Air M3") matches nothing — CJ silently reports zero products and an active
 * provider with real ZORINO inventory is invisible in /search.
 *
 * The fix fans out progressively-shorter prefixes for device-intent searches
 * (full query always first), so every meaningful part of the query actually
 * reaches CJ's catalog. Gated on `optimizeForDeviceIntent`, mirroring the
 * AliExpress/eBay device adaptations, so homepage/Compare stay byte-identical.
 */
import { describe, expect, it } from "vitest";

import { buildCjSearchQueries } from "@/lib/search/connectors/cjdropshipping";

describe("buildCjSearchQueries — CJ keyword reach", () => {
  it("keeps the query verbatim when the caller does not opt in (homepage/Compare)", () => {
    expect(buildCjSearchQueries("iphone 15 pro max")).toEqual(["iphone 15 pro max"]);
    expect(buildCjSearchQueries("macbook air m3", undefined)).toEqual(["macbook air m3"]);
    expect(buildCjSearchQueries("", { optimizeForDeviceIntent: true })).toEqual([]);
  });

  it("fans out a compound device query into reachable prefixes, original first", () => {
    const queries = buildCjSearchQueries("iphone 15 pro max", {
      optimizeForDeviceIntent: true,
    });
    expect(queries[0]).toBe("iphone 15 pro max");
    expect(queries).toContain("iphone 15 pro");
    expect(queries).toContain("iphone 15");
    expect(queries.length).toBeLessThanOrEqual(3);
  });

  it("fans out laptop and watch-style compound queries", () => {
    const laptop = buildCjSearchQueries("macbook air m3", { optimizeForDeviceIntent: true });
    expect(laptop[0]).toBe("macbook air m3");
    expect(laptop).toContain("macbook air");
    expect(laptop).toContain("macbook");

    const watch = buildCjSearchQueries("samsung galaxy s24", { optimizeForDeviceIntent: true });
    expect(watch[0]).toBe("samsung galaxy s24");
    expect(watch).toContain("samsung galaxy");
    expect(watch).toContain("samsung");
  });

  it("bounds the fan-out to 3 keyword variants", () => {
    const queries = buildCjSearchQueries("wireless bluetooth earbuds pro max", {
      optimizeForDeviceIntent: true,
    });
    expect(queries.length).toBe(3);
    expect(queries[0]).toBe("wireless bluetooth earbuds pro max");
  });

  it("fans out accessory queries too (CJ matches substrings, not words)", () => {
    const queries = buildCjSearchQueries("iphone 15 case", {
      optimizeForDeviceIntent: true,
    });
    expect(queries[0]).toBe("iphone 15 case");
    expect(queries).toContain("iphone 15");
    expect(queries).toContain("iphone");
  });

  it("does not fan out a single-token query", () => {
    expect(buildCjSearchQueries("earbuds", { optimizeForDeviceIntent: true })).toEqual([
      "earbuds",
    ]);
  });

  it("trims edge whitespace and collapses spaces only in the generated variants", () => {
    const queries = buildCjSearchQueries("  iphone   15   pro max  ", {
      optimizeForDeviceIntent: true,
    });
    expect(queries[0]).toBe("iphone   15   pro max");
    expect(queries).toContain("iphone 15");
    expect(queries.length).toBe(3);
  });
});