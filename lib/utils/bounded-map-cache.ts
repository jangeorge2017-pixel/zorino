/**
 * Insert into a Map-backed cache while enforcing a maximum entry count.
 *
 * Eviction order: expired entries first (using their `expiresAt`), then the
 * oldest inserted entry, so the cache can never grow without bound. Shared by
 * the search, canonical-search and device-count caches so the bounding policy
 * lives in exactly one place.
 */
export function setBoundedCacheEntry<K, V extends { expiresAt: number }>(
  cache: Map<K, V>,
  key: K,
  value: V,
  maxEntries: number,
): void {
  if (cache.size >= maxEntries) {
    const now = Date.now();
    for (const [existingKey, entry] of cache) {
      if (entry.expiresAt <= now) cache.delete(existingKey);
    }
    while (cache.size >= maxEntries) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      cache.delete(oldestKey);
    }
  }
  cache.set(key, value);
}
