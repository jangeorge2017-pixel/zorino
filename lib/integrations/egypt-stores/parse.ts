const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (entity, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? entity);
}

export function stripTags(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function getAttribute(tag: string, name: string): string | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  const value = match?.[1] ?? match?.[2] ?? match?.[3];
  return value == null ? null : decodeHtmlEntities(value);
}

export function firstMatch(source: string, pattern: RegExp): string | null {
  const match = pattern.exec(source);
  return match?.[1] ?? null;
}

export function resolveUrl(href: string | null | undefined, base: string): string | null {
  const trimmed = href?.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) return null;
  try {
    return new URL(trimmed, base).toString();
  } catch {
    return null;
  }
}

export function parseMoney(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) && raw > 0 ? raw : 0;
  const text = String(raw ?? "")
    .replace(/[\u0660-\u0669]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\u066c/g, "")
    .replace(/\u066b/g, ".");
  const match = /(\d[\d,.\s]*)/.exec(text);
  if (!match) return 0;
  const compact = match[1].replace(/\s+/g, "").replace(/,/g, "");
  const value = Number.parseFloat(compact);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function discountPercent(price: number, originalPrice: number): number {
  if (!Number.isFinite(price) || !Number.isFinite(originalPrice)) return 0;
  if (price <= 0 || originalPrice <= price) return 0;
  return Math.max(0, Math.round(((originalPrice - price) / originalPrice) * 100));
}

export function cleanTitle(value: string | null | undefined): string {
  return decodeHtmlEntities(String(value ?? ""))
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*Image\s+\d+\s*$/i, "")
    .trim();
}
