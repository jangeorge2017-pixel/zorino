interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * In-memory TTL cache for provider responses.
 * Swap for Redis/Upstash in multi-instance production deployments.
 */
export class DataLayerCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }

    this.hits += 1;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
    };
  }
}

export function buildCacheKey(
  providerId: string,
  operation: string,
  params?: Record<string, unknown>
): string {
  const paramKey = params ? stableSerialize(params) : "";
  return `${providerId}:${operation}:${paramKey}`;
}

function stableSerialize(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "object") return String(value);

  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${k}:${stableSerialize(record[k])}`).join(",")}}`;
}

export const globalDataLayerCache = new DataLayerCache();
