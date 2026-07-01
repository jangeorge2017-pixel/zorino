import { createDataLayerError } from "@/lib/data-layer/types/errors";
import type { DataProviderId } from "@/lib/data-layer/types";

interface RateLimitBucket {
  timestamps: number[];
}

/**
 * Per-provider sliding-window rate limiter.
 */
export class ProviderRateLimiter {
  private buckets = new Map<string, RateLimitBucket>();

  constructor(private defaultLimitPerMinute = 60) {}

  isAllowed(providerId: DataProviderId, limitPerMinute?: number): boolean {
    const limit = limitPerMinute ?? this.defaultLimitPerMinute;
    const now = Date.now();
    const windowMs = 60_000;
    const bucket = this.buckets.get(providerId) ?? { timestamps: [] };

    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs);

    if (bucket.timestamps.length >= limit) {
      this.buckets.set(providerId, bucket);
      return false;
    }

    bucket.timestamps.push(now);
    this.buckets.set(providerId, bucket);
    return true;
  }

  assertAllowed(providerId: DataProviderId, limitPerMinute?: number) {
    if (!this.isAllowed(providerId, limitPerMinute)) {
      throw createDataLayerError(
        "RATE_LIMITED",
        `Rate limit exceeded for provider ${providerId}`,
        providerId,
        { retryable: true }
      );
    }
  }

  reset(providerId?: DataProviderId) {
    if (providerId) {
      this.buckets.delete(providerId);
    } else {
      this.buckets.clear();
    }
  }
}

export const globalRateLimiter = new ProviderRateLimiter();
