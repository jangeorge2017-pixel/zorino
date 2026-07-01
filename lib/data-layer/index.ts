/**
 * Zorino Data Layer
 *
 * Provider-agnostic marketplace data access with caching, rate limiting,
 * retries, queuing, and structured error handling.
 *
 * @example
 * ```ts
 * import { getProviderManager } from "@/lib/data-layer";
 *
 * const manager = getProviderManager();
 * const result = await manager.getProducts("amazon", { limit: 20 });
 * ```
 */

// Types
export * from "@/lib/data-layer/types";

// Configuration
export * from "@/lib/data-layer/config";

// Core infrastructure
export * from "@/lib/data-layer/core";

// Providers
export * from "@/lib/data-layer/providers";

// Convenience singleton
export { getProviderManager, ProviderManager } from "@/lib/data-layer/core/manager";
