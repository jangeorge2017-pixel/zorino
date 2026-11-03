/**
 * Search-specific cache with Node Cache pattern
 * Extends the existing in-memory cache pattern for search-specific use cases
 */

interface SearchCacheOptions {
  ttl?: number; // TTL in milliseconds
  maxEntries?: number;
}

interface SearchCacheStats {
  size: number;
  maxEntries: number;
  hitRate: number;
  hits: number;
  misses: number;
}

interface CacheStats {
  hits: number;
  misses: number;
}

class SearchCache {
  private cache: Map<string, unknown>;
  private defaultTTL: number;
  private maxEntries: number;
  private stats: CacheStats;

  constructor(options: SearchCacheOptions = {}) {
    this.cache = new Map();
    this.defaultTTL = options.ttl || 5 * 60 * 1000; // 5 minutes default
    this.maxEntries = options.maxEntries || 500;
    this.stats = { hits: 0, misses: 0 };
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if ((entry as { expiresAt: number }).expiresAt < now) {
        this.cache.delete(key);
      }
    }

    // If still over max entries, remove oldest entries
    if (this.cache.size >= this.maxEntries) {
      const entriesToDelete = this.cache.size - this.maxEntries + 1;
      const keysToDelete = Array.from(this.cache.keys()).slice(0, entriesToDelete);
      keysToDelete.forEach(key => this.cache.delete(key));
    }
  }

  private generateKey(query: string, options: Record<string, unknown> = {}): string {
    const optionsStr = JSON.stringify(options);
    return `${query.toLowerCase().trim()}:${optionsStr}`;
  }

  set(key: string, data: unknown, ttl?: number): void {
    this.cleanup();
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + (ttl || 5 * 60 * 1000), // 5 min default
      query: key,
    });
  }

  get(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > (entry as { expiresAt: number }).expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return (entry as { data: unknown }).data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  getStats(): SearchCacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      hits: this.stats.hits,
      misses: this.stats.misses,
    };
  }

  // Search-specific cache methods
  async getOrFetch(
    query: string,
    fetcher: () => Promise<unknown>,
    options: {
      ttl?: number;
      language?: string;
      sort?: string;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<unknown> {
    // Try cache first
    const cached = this.get(query);
    if (cached) {
      return cached;
    }

    // Fetch fresh data
    try {
      const data = await fetcher();
      this.set(query, data, options.ttl || 5 * 60 * 1000);
      return data;
    } catch (error) {
      console.error('[SearchCache] Fetch failed:', error);
      throw error;
    }
  }

  // Clear all cache entries
  clearAll(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }
}

// Export singleton instance
export const searchCache = new SearchCache({
  ttl: 5 * 60 * 1000, // 5 minutes
  maxEntries: 500,
});

export type { SearchCacheOptions, SearchCacheStats };