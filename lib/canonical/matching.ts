/**
 * Deterministic identifier/attribute-based product matching (Phase 1).
 *
 * Replaces the title-heuristic matchers with a deterministic, signal-ordered
 * hierarchy. Title similarity is DEMOTED to a last-resort "suggested" signal
 * and is never auto-merged in production.
 *
 * Signal order (highest to lowest):
 *   1. Global identifiers (GTIN/UPC/EAN/MPN/ASIN/part-number) — exact → "exact"
 *   2. Provider-native id via externalOfferId mapping — exact → "exact"
 *   3. Brand + Model (+ variant-neutral spec fingerprint) — deterministic → "strong"
 *   4. Fuzzy title similarity — last resort, returns "suggested"/"weak" only,
 *      never "exact"/"strong".
 *
 * All functions are pure and deterministic (no randomness, no I/O).
 */

import type {
  IdentityMatch,
  IdentifierType,
  OfferIdentifier,
} from "@/lib/canonical/types";
import { normalizeTitleKey, titleSimilarity } from "@/lib/marketplace-engine/utils";

// ─── Identifier comparison (case-insensitive, whitespace-normalized) ──────
/** Stable identifier blocks (GTIN/EAN/UPC interchangeable as one numeric space). */
const STRONG_ID_TYPES = new Set<IdentifierType>(["gtin", "upc", "ean", "asin", "mpn"]);

function canonicalIdentifierValue(value: string): string {
  // GTIN/EAN/UPC: strip spaces/dashes, compare digits only.
  return value.trim().toLowerCase().replace(/[\s\-]+/g, "");
}

interface HasIdentifiers {
  identifiers?: OfferIdentifier[];
}

// ─── Identity extraction ───────────────────────────────────────────────────
function extractStrongIdentifiers(offers: HasIdentifiers[]): {
  type: IdentifierType;
  value: string;
} | null {
  for (const offer of offers) {
    for (const id of offer.identifiers ?? []) {
      if (STRONG_ID_TYPES.has(id.type)) {
        return { type: id.type, value: canonicalIdentifierValue(id.value) };
      }
    }
  }
  return null;
}

function extractProviderIdPair(
  a: { providerId: string; externalOfferId?: string },
  b: { providerId: string; externalOfferId?: string },
): { providerId: string; externalOfferId: string } | null {
  if (!a.externalOfferId || !b.externalOfferId) return null;
  if (a.providerId !== b.providerId) return null;
  if (a.externalOfferId !== b.externalOfferId) return null;
  return { providerId: a.providerId, externalOfferId: a.externalOfferId };
}

// ─── Brand + model signals ─────────────────────────────────────────────────
/** True when both offers have a brand AND a model and they match exactly. */
function brandModelStrong(
  a: { brand?: string; model?: string },
  b: { brand?: string; model?: string },
): boolean {
  const brandA = normalizeTitleKey(a.brand ?? "");
  const brandB = normalizeTitleKey(b.brand ?? "");
  const modelA = normalizeTitleKey(a.model ?? "");
  const modelB = normalizeTitleKey(b.model ?? "");
  return (
    brandA.length > 0 &&
    brandB.length > 0 &&
    modelA.length > 0 &&
    modelB.length > 0 &&
    brandA === brandB &&
    modelA === modelB
  );
}

// ─── Variant spec fingerprint ──────────────────────────────────────────────
/** Deterministic fingerprint of capacity/size/color/spec attrs (variant-aware). */
export function variantFingerprint(attributes?: Record<string, string>): string {
  if (!attributes) return "";
  const norm: Record<string, string> = {};
  for (const [key, raw] of Object.entries(attributes)) {
    const k = normalizeTitleKey(key);
    const v = normalizeTitleKey(String(raw ?? ""));
    if (k && v) norm[k] = v;
  }
  const sorted = Object.keys(norm).sort();
  return sorted.map((k) => `${k}=${norm[k]}`).join("|");
}

/**
 * Same variant decision, attribute-derived. When both offers carry a spec they
 * must match exactly; when neither carries a spec we conservatively assume the
 * same variant (no conflicting signal).
 */
function sameVariantBySpec(
  a: { attributes?: Record<string, string> },
  b: { attributes?: Record<string, string> },
): boolean {
  const specA = variantFingerprint(a.attributes);
  const specB = variantFingerprint(b.attributes);
  if (specA === "" && specB === "") return true;
  return specA !== "" && specB !== "" && specA === specB;
}

/**
 * Deterministically judge whether two offers represent the same product.
 * Returns a confidence + signals, never throws.
 */
export function matchOffers(
  a: {
    providerId: string;
    externalOfferId?: string;
    brand?: string;
    model?: string;
    title: string;
    identifiers?: OfferIdentifier[];
    attributes?: Record<string, string>;
  },
  b: {
    providerId: string;
    externalOfferId?: string;
    brand?: string;
    model?: string;
    title: string;
    identifiers?: OfferIdentifier[];
    attributes?: Record<string, string>;
  },
): IdentityMatch {
  // 1. Provider-native id (exact same product on one provider).
  const providerPair = extractProviderIdPair(a, b);
  if (providerPair) {
    return { confidence: "exact", signals: ["same-provider-external-id"], sameVariant: true };
  }

  // 2. Global identifier block (exact identity).
  const aId = extractStrongIdentifiers([{ identifiers: a.identifiers }]);
  const bId = extractStrongIdentifiers([{ identifiers: b.identifiers }]);
  if (aId && bId) {
    if (aId.value === bId.value) {
      return { confidence: "exact", signals: [`identifier-${aId.type}`], sameVariant: true };
    }
    // Different identifiers => definitely different products.
    return { confidence: "weak", signals: ["identifier-conflict"], sameVariant: false };
  }

  // 3. Brand + Model (deterministic strong match).
  if (brandModelStrong(a, b)) {
    // Variant-aware: if both offer a spec and it differs, it's a different
    // variant of the same base product.
    const sameVariant = sameVariantBySpec(a, b);
    return {
      confidence: "strong",
      signals: ["brand-model" + (sameVariant ? "-variant" : "")],
      sameVariant,
    };
  }

  // 4. Last resort: fuzzy title (suggested/weak only — NEVER auto-merge).
  const sim = titleSimilarity(a.title, b.title);
  if (sim >= 0.72) {
    return { confidence: "suggested", signals: ["title-strong"], sameVariant: true };
  }
  if (sim >= 0.55) {
    return { confidence: "weak", signals: ["title-weak"], sameVariant: false };
  }
  return { confidence: "weak", signals: ["no-match"], sameVariant: false };
}

// ─── Attribute equality (deterministic) ────────────────────────────────────
/** True when two attribute maps agree on every key both define. */
export function attributesCompatible(
  a: Record<string, string> | undefined,
  b: Record<string, string> | undefined,
): boolean {
  if (!a || !b) return true; // absent attrs are compatible (no signal)
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  const shared = new Set([...aKeys, ...bKeys]);
  for (const key of shared) {
    const va = a[key];
    const vb = b[key];
    if (va === undefined || vb === undefined) continue; // only compare shared
    if (normalizeTitleKey(va) !== normalizeTitleKey(vb)) return false;
  }
  return true;
}

// ─── Deterministic product key ─────────────────────────────────────────────
/**
 * Stable fallback key when no identifier is available. Uses brand+model when
 * present; otherwise the normalized title. Used only to coalesce duplicate
 * feed rows and is NOT a production merge authority.
 */
export function canonicalProductKey(input: {
  title: string;
  brand?: string;
  model?: string;
}): string {
  const brand = normalizeTitleKey(input.brand ?? "");
  const model = normalizeTitleKey(input.model ?? "");
  if (brand && model) {
    return `bm|${brand}|${model}`.slice(0, 160);
  }
  return `title|${normalizeTitleKey(input.title)}`.slice(0, 160);
}