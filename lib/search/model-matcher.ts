import {
  classifyListingPair,
  clusterSignature,
  listingPairProvenDifferent,
} from "@/lib/search/cluster";
import { hasAccessoryTerm } from "@/lib/search/accessory-exclusion";
import {
  normalizeText,
  stripECommerceNoise,
} from "@/lib/search/text-normalization";

const MODEL_CODE_RE = /^(?=[^\d]*\d)[\p{L}\d]+$/u;
const STORAGE_RE = /^(\d{1,4})(gb|tb)$/;
const MAX_SMART_QUERY_TOKENS = 8;

function meaningfulTokens(name: string): string[] {
  return stripECommerceNoise(normalizeText(name))
    .split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 1 &&
        !/^\d+$/.test(token) &&
        !["and", "for", "with", "the", "new", "sale", "shop"].includes(token),
    );
}

function sharedTokens(a: string, b: string): string[] {
  const right = new Set(meaningfulTokens(b));
  return [...new Set(meaningfulTokens(a))].filter((token) => right.has(token));
}

function modelTokens(model: string | null): string[] {
  if (!model) return [];
  return model
    .split("-")
    .map((token) => token.trim())
    .filter((token) => token && token !== "console");
}

export function buildSmartModelQuery(name: string): string {
  const signature = clusterSignature(name);
  const parts: string[] = [];
  const push = (token: string): void => {
    const normalized = normalizeText(token).trim();
    if (!normalized || parts.includes(normalized)) return;
    parts.push(normalized);
  };

  for (const token of modelTokens(signature.model)) push(token);
  if (signature.storage) push(signature.storage);
  if (!signature.model && signature.brand) push(signature.brand);

  for (const token of meaningfulTokens(name)) {
    if (parts.length >= MAX_SMART_QUERY_TOKENS) break;
    if (STORAGE_RE.test(token) || MODEL_CODE_RE.test(token) || token.length >= 5) {
      push(token);
    }
  }

  return parts.slice(0, MAX_SMART_QUERY_TOKENS).join(" ");
}

export function isSmartModelMatch(baseName: string, candidateName: string): boolean {
  return smartMatchScore(baseName, candidateName) > 0;
}

export function smartMatchScore(baseName: string, candidateName: string): number {
  if (!baseName || !candidateName) return 0;
  if (
    listingPairProvenDifferent(
      { title: baseName },
      { title: candidateName },
    )
  ) {
    return 0;
  }
  if (hasAccessoryTerm(baseName) !== hasAccessoryTerm(candidateName)) return 0;

  const signatureMatch = classifyListingPair(
    { title: baseName },
    { title: candidateName },
  );
  if (signatureMatch !== null) return Math.round(signatureMatch * 1000);

  const shared = sharedTokens(baseName, candidateName);
  if (shared.length === 0) return 0;

  const strongShared = shared.filter(
    (token) => /\d/.test(token) || token.length >= 5,
  );
  if (strongShared.length === 0 && shared.length < 2) return 0;

  const baseSignature = clusterSignature(baseName);
  const candidateSignature = clusterSignature(candidateName);
  if (
    baseSignature.storage &&
    candidateSignature.storage &&
    baseSignature.storage !== candidateSignature.storage
  ) {
    return 0;
  }

  let score = shared.length * 10;
  score += strongShared.length * 20;
  if (baseSignature.brand && baseSignature.brand === candidateSignature.brand) {
    score += 15;
  }
  if (baseSignature.storage && baseSignature.storage === candidateSignature.storage) {
    score += 10;
  }
  return score;
}
