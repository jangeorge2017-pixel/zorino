/**
 * AliExpress `aliexpress.affiliate.link.generate` response parsing.
 *
 * The API is inconsistent about the shape of `result.promotion_links`:
 *   - `result.promotion_links.promotion_link[]` (documented, nested OBJECT)
 *   - `result.promotion_links[]` (plain ARRAY of objects)
 *   - `result.promotion_links[]` (ARRAY of STRINGS)
 *   - `result.promotion_links.promotion_link` (single object / single string)
 *
 * This module normalizes ALL of those variants into a flat list of
 * `{ source_value, promotion_link }` pairs so the caller never iterates the
 * wrong container type (the old code treated the OBJECT form as an array,
 * which made link.generate silently return nothing on real responses).
 *
 * Pure logic — no imports, no I/O — so it is directly unit-testable.
 */

export type PromotionLinkPair = {
  /** Original (untracked) product URL the tracked link was generated for. */
  source_value?: string;
  /** The tracked deep link / affiliate URL. */
  promotion_link?: string;
};

function asString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // A promotion link must be an absolute http(s) URL string. Garbage strings
    // are dropped here so the caller only ever filters real links.
    return /^https?:\/\//i.test(trimmed) ? trimmed : null;
  }
  return null;
}

/** Normalize a single promotion_link entry (string or object). */
export function normalizePromotionEntry(entry: unknown): PromotionLinkPair | null {
  if (typeof entry === "string") {
    const url = asString(entry);
    return url ? { promotion_link: url } : null;
  }
  if (entry && typeof entry === "object") {
    const record = entry as Record<string, unknown>;
    const promotionLink =
      asString(record.promotion_link ?? record.url ?? record.target_url ?? null) ?? null;
    const sourceValue = asString(record.source_value ?? record.source ?? null) ?? null;
    if (promotionLink) return { source_value: sourceValue ?? undefined, promotion_link: promotionLink };
  }
  return null;
}

function collectEntries(node: unknown, out: PromotionLinkPair[]): void {
  if (node == null) return;

  if (Array.isArray(node)) {
    for (const item of node) {
      if (Array.isArray(item) || (item && typeof item === "object" && "promotion_link" in item)) {
        collectEntries(item, out);
      } else {
        const pair = normalizePromotionEntry(item);
        if (pair) out.push(pair);
      }
    }
    return;
  }

  if (typeof node === "object") {
    const record = node as Record<string, unknown>;
    // Documented nested form: { promotion_link: [...] } or { promotion_link: {...} }.
    const nested = record.promotion_link;
    if (nested != null) {
      collectEntries(nested, out);
      return;
    }
    // Some responses nest under `link` instead.
    if (record.link != null && typeof record.link === "object") {
      collectEntries(record.link, out);
      return;
    }
    const pair = normalizePromotionEntry(node);
    if (pair) out.push(pair);
    return;
  }

  const pair = normalizePromotionEntry(node);
  if (pair) out.push(pair);
}

/**
 * Flatten any `promotion_links` variant into a deduplicated list of
 * `{ source_value, promotion_link }` pairs. Entries without a usable
 * promotion_link are dropped.
 */
export function extractPromotionLinks(node: unknown): PromotionLinkPair[] {
  const out: PromotionLinkPair[] = [];
  collectEntries(node, out);
  const seen = new Set<string>();
  const result: PromotionLinkPair[] = [];
  for (const pair of out) {
    const key = pair.source_value ?? pair.promotion_link ?? "";
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(pair);
  }
  return result;
}