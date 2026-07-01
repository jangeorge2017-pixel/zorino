import { createDataLayerError, isDataLayerError } from "@/lib/data-layer/types/errors";
import type { DataProviderId } from "@/lib/data-layer/types";
import { dataLayerLogger } from "@/lib/data-layer/core/logger";

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  providerId: DataProviderId;
  operation: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: unknown): boolean {
  if (isDataLayerError(error)) return error.retryable;
  return true;
}

/**
 * Exponential backoff retry wrapper for provider calls.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { maxAttempts, baseDelayMs, providerId, operation } = options;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      const retryable = isRetryableError(error);
      dataLayerLogger.warn("Provider call failed", {
        providerId,
        operation,
        attempt,
        retryable,
        error: error instanceof Error ? error.message : String(error),
      });

      if (!retryable || attempt >= maxAttempts) {
        break;
      }

      const backoff = baseDelayMs * 2 ** (attempt - 1);
      await delay(backoff);
    }
  }

  if (isDataLayerError(lastError)) {
    throw lastError;
  }

  throw createDataLayerError(
    "PROVIDER_ERROR",
    lastError instanceof Error ? lastError.message : "Provider call failed",
    providerId,
    { retryable: false, cause: lastError }
  );
}
