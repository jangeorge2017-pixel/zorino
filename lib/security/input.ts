const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRODUCT_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function isProductId(value: string): boolean {
  return PRODUCT_ID_RE.test(value);
}

export function clampString(value: string | undefined, max: number): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
}
