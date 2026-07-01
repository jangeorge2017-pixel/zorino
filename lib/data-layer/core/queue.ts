import { createDataLayerError } from "@/lib/data-layer/types/errors";
import type { DataProviderId } from "@/lib/data-layer/types";
import { dataLayerLogger } from "@/lib/data-layer/core/logger";

type QueueTask<T> = () => Promise<T>;

interface QueueState {
  pending: number;
  tail: Promise<unknown>;
}

/**
 * Serializes outbound provider requests per provider ID
 * to avoid burst traffic and respect rate limits.
 */
export class ProviderRequestQueue {
  private queues = new Map<string, QueueState>();

  constructor(private maxPendingPerProvider = 100) {}

  async enqueue<T>(
    providerId: DataProviderId,
    operation: string,
    task: QueueTask<T>
  ): Promise<T> {
    const key = `${providerId}:${operation}`;
    const state = this.queues.get(key) ?? { pending: 0, tail: Promise.resolve() };

    if (state.pending >= this.maxPendingPerProvider) {
      throw createDataLayerError(
        "QUEUE_OVERFLOW",
        `Request queue full for ${providerId}`,
        providerId,
        { retryable: true }
      );
    }

    state.pending += 1;
    this.queues.set(key, state);

    const run = state.tail.then(async () => {
      dataLayerLogger.debug("Dequeuing provider request", { providerId, operation });
      return task();
    });

    state.tail = run.catch(() => undefined);
    this.queues.set(key, state);

    try {
      return await run;
    } finally {
      state.pending = Math.max(0, state.pending - 1);
      this.queues.set(key, state);
    }
  }

  stats() {
    const entries: Record<string, number> = {};
    for (const [key, state] of this.queues.entries()) {
      entries[key] = state.pending;
    }
    return entries;
  }

  clear() {
    this.queues.clear();
  }
}

export const globalRequestQueue = new ProviderRequestQueue();
