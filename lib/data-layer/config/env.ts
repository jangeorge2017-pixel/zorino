/**
 * Secure environment variable access for the data layer.
 * Never logs secret values — only key names and configuration status.
 */

export type EnvReadResult<T> =
  | { ok: true; value: T }
  | { ok: false; missing: string[] };

const PLACEHOLDER_PATTERNS = [
  /^$/,
  /^your[-_]/i,
  /^changeme$/i,
  /^placeholder$/i,
  /^xxx+$/i,
  /^<.*>$/,
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value?.trim()) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

/** Read a single env var; returns undefined when missing or placeholder. */
export function readEnv(key: string): string | undefined {
  const value = process.env[key];
  if (isPlaceholder(value)) return undefined;
  return value?.trim();
}

/** Check whether all required keys are present and non-placeholder. */
export function checkEnvKeys(keys: string[]): EnvReadResult<Record<string, string>> {
  const missing: string[] = [];
  const value: Record<string, string> = {};

  for (const key of keys) {
    const envValue = readEnv(key);
    if (!envValue) {
      missing.push(key);
    } else {
      value[key] = envValue;
    }
  }

  if (missing.length > 0) {
    return { ok: false, missing };
  }

  return { ok: true, value };
}

export function isEnvConfigured(keys: string[]): boolean {
  return checkEnvKeys(keys).ok;
}

/** Parse integer env with fallback. */
export function readEnvInt(key: string, fallback: number): number {
  const raw = readEnv(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Parse boolean env (true/1/yes). */
export function readEnvBool(key: string, fallback = false): boolean {
  const raw = readEnv(key);
  if (!raw) return fallback;
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

/** Redact secret for safe logging — shows only last 4 chars when present. */
export function redactSecret(value: string | undefined): string {
  if (!value) return "[unset]";
  if (value.length <= 4) return "****";
  return `****${value.slice(-4)}`;
}

/** Summarize credential status without exposing values. */
export function summarizeCredentialStatus(keys: string[]): {
  configured: boolean;
  missingKeys: string[];
  presentKeys: string[];
} {
  const missingKeys: string[] = [];
  const presentKeys: string[] = [];

  for (const key of keys) {
    if (readEnv(key)) {
      presentKeys.push(key);
    } else {
      missingKeys.push(key);
    }
  }

  return {
    configured: missingKeys.length === 0,
    missingKeys,
    presentKeys,
  };
}

export const DATA_LAYER_ENV = {
  cacheTtlMs: "DATA_LAYER_CACHE_TTL_MS",
  rateLimitPerMinute: "DATA_LAYER_RATE_LIMIT_PER_MIN",
  maxRetries: "DATA_LAYER_MAX_RETRIES",
  retryBaseMs: "DATA_LAYER_RETRY_BASE_MS",
  queueMaxPending: "DATA_LAYER_QUEUE_MAX_PENDING",
  logLevel: "DATA_LAYER_LOG_LEVEL",
  enabled: "DATA_LAYER_ENABLED",
} as const;

export function getDataLayerConfig() {
  return {
    enabled: readEnvBool(DATA_LAYER_ENV.enabled, true),
    cacheTtlMs: readEnvInt(DATA_LAYER_ENV.cacheTtlMs, 5 * 60 * 1000),
    rateLimitPerMinute: readEnvInt(DATA_LAYER_ENV.rateLimitPerMinute, 60),
    maxRetries: readEnvInt(DATA_LAYER_ENV.maxRetries, 3),
    retryBaseMs: readEnvInt(DATA_LAYER_ENV.retryBaseMs, 500),
    queueMaxPending: readEnvInt(DATA_LAYER_ENV.queueMaxPending, 100),
    logLevel: readEnv(DATA_LAYER_ENV.logLevel) ?? "info",
  };
}
