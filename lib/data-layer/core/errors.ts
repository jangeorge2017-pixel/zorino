import { createDataLayerError, isDataLayerError } from "@/lib/data-layer/types/errors";
import type { DataProviderId } from "@/lib/data-layer/types";
import { dataLayerLogger } from "@/lib/data-layer/core/logger";

export function normalizeProviderError(
  error: unknown,
  providerId: DataProviderId,
  operation: string
) {
  if (isDataLayerError(error)) return error;

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("timeout") || message.includes("timed out")) {
      return createDataLayerError("TIMEOUT", error.message, providerId, {
        cause: error,
      });
    }
    if (message.includes("network") || message.includes("fetch")) {
      return createDataLayerError("NETWORK", error.message, providerId, {
        cause: error,
      });
    }
    return createDataLayerError(
      "PROVIDER_ERROR",
      `${operation} failed: ${error.message}`,
      providerId,
      { cause: error, retryable: false }
    );
  }

  return createDataLayerError(
    "PROVIDER_ERROR",
    `${operation} failed with unknown error`,
    providerId,
    { cause: error, retryable: false }
  );
}

export function toFailedResult<T>(
  error: unknown,
  providerId: DataProviderId,
  operation: string,
  meta: { durationMs: number; attempt: number; cached?: boolean }
) {
  const normalized = normalizeProviderError(error, providerId, operation);
  dataLayerLogger.error(normalized.message, {
    providerId,
    operation,
    code: normalized.code,
    durationMs: meta.durationMs,
    attempt: meta.attempt,
  });

  return {
    success: false as const,
    data: [] as unknown as T,
    error: normalized,
    meta: {
      providerId,
      cached: meta.cached ?? false,
      durationMs: meta.durationMs,
      timestamp: new Date().toISOString(),
      attempt: meta.attempt,
    },
  };
}
