/** Structured AliExpress API debug logging (server-only). Never logs secrets. */

const PREFIX = "[aliexpress-api]";

const SENSITIVE_PARAM_KEYS = new Set([
  "app_key",
  "app_secret",
  "sign",
  "tracking_id",
  "session",
  "access_token",
]);

export function logAliExpress(message: string, details?: unknown): void {
  if (details === undefined) {
    console.error(`${PREFIX} ${message}`);
    return;
  }
  try {
    console.error(`${PREFIX} ${message}`, JSON.stringify(sanitizeForLog(details), null, 2));
  } catch {
    console.error(`${PREFIX} ${message}`, "[unserializable details]");
  }
}

export function maskSecret(value: string | undefined): string {
  if (!value) return "(empty)";
  return `(present, len=${value.length})`;
}

/** Redact credential-bearing request params before any log output. */
export function redactRequestForLog(params: Record<string, string>): Record<string, string> {
  const redacted: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (SENSITIVE_PARAM_KEYS.has(key.toLowerCase())) {
      redacted[key] = maskSecret(value);
      continue;
    }
    redacted[key] = value;
  }
  return redacted;
}

function sanitizeForLog(value: unknown): unknown {
  if (value == null) return value;
  if (typeof value === "string") return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (Array.isArray(value)) return value.map(sanitizeForLog);
  if (typeof value !== "object") return value;

  const input = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(input)) {
    if (SENSITIVE_PARAM_KEYS.has(key.toLowerCase())) {
      out[key] = typeof nested === "string" ? maskSecret(nested) : "[redacted]";
      continue;
    }
    if (key === "params" && nested && typeof nested === "object" && !Array.isArray(nested)) {
      out[key] = redactRequestForLog(nested as Record<string, string>);
      continue;
    }
    if (key === "body" && typeof nested === "string") {
      out[key] = "[omitted]";
      continue;
    }
    out[key] = sanitizeForLog(nested);
  }
  return out;
}
