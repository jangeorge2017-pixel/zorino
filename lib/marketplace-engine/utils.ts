import type { ExternalProduct } from "@/lib/sync/types";
import type { ProductIdentifier, ProductIdentifierType } from "@/lib/marketplace-engine/types";
import { IDENTIFIER_SPEC_KEYS } from "@/lib/marketplace-engine/config";

export function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenizeTitle(title: string): Set<string> {
  const stopWords = new Set(["the", "a", "an", "for", "with", "and", "or", "new", "free"]);
  return new Set(
    normalizeTitleKey(title)
      .split(" ")
      .filter((t) => t.length > 2 && !stopWords.has(t))
  );
}

/** Jaccard similarity between two product titles (0–1). */
export function titleSimilarity(a: string, b: string): number {
  const tokensA = tokenizeTitle(a);
  const tokensB = tokenizeTitle(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export function extractProductIdentifiers(product: ExternalProduct): ProductIdentifier[] {
  const identifiers: ProductIdentifier[] = [];
  const seen = new Set<string>();

  const add = (type: ProductIdentifierType, raw?: string | null) => {
    const value = raw?.trim().replace(/\s+/g, "");
    if (!value || value.length < 4) return;
    const key = `${type}:${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    identifiers.push({ type, value });
  };

  if (product.specifications) {
    for (const [type, keys] of Object.entries(IDENTIFIER_SPEC_KEYS)) {
      for (const key of keys) {
        add(type as ProductIdentifierType, product.specifications[key]);
      }
    }
  }

  add("sku", product.externalId);

  return identifiers;
}

export function computeSavingsPercent(lowest: number, highest: number): number {
  if (highest <= 0 || lowest >= highest) return 0;
  return Math.round(((highest - lowest) / highest) * 10000) / 100;
}

export function computeDiscountPercent(price: number, original: number): number {
  if (original <= 0 || price >= original) return 0;
  return Math.round(((original - price) / original) * 10000) / 100;
}

export function computePriceChange(
  previous: number | undefined,
  current: number
): { changePercent: number; changeDirection: "up" | "down" | "same" | "new" } {
  if (previous === undefined) {
    return { changePercent: 0, changeDirection: "new" };
  }
  if (previous === current) {
    return { changePercent: 0, changeDirection: "same" };
  }
  const changePercent =
    previous > 0 ? Math.round(((current - previous) / previous) * 10000) / 100 : 0;
  return {
    changePercent,
    changeDirection: current > previous ? "up" : "down",
  };
}
