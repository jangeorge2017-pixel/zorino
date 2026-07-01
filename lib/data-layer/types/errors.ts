import type { DataProviderId } from "@/lib/data-layer/types/provider";

/** Standard error codes returned by the data layer. */
export type DataLayerErrorCode =
  | "NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK"
  | "PROVIDER_ERROR"
  | "NOT_FOUND"
  | "VALIDATION"
  | "QUEUE_OVERFLOW";

export interface DataLayerError {
  code: DataLayerErrorCode;
  message: string;
  providerId: DataProviderId;
  retryable: boolean;
  cause?: unknown;
}

export function createDataLayerError(
  code: DataLayerErrorCode,
  message: string,
  providerId: DataProviderId,
  options?: { retryable?: boolean; cause?: unknown }
): DataLayerError {
  const retryable =
    options?.retryable ??
    (code === "RATE_LIMITED" || code === "TIMEOUT" || code === "NETWORK");

  return {
    code,
    message,
    providerId,
    retryable,
    cause: options?.cause,
  };
}

export function isDataLayerError(value: unknown): value is DataLayerError {
  return (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    "providerId" in value &&
    "retryable" in value
  );
}
