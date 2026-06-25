export { loadAliExpressCredentials, getAliExpressStatus, validateAliExpressCredentials } from "./credentials";
export { logImportEvent, getImportEventLogs, getAliExpressSyncSummary } from "./monitoring";
export { runAliExpressSync, runAliExpressScheduledSync } from "./scheduler";
export {
  generateAliExpressAffiliateLink,
  generateAliExpressAffiliateLinks,
  type AffiliateLinkInput,
  type AffiliateLinkResult,
} from "./affiliate-links";

export async function importAliExpressProducts() {
  const { runAliExpressSync } = await import("./scheduler");
  return runAliExpressSync("products");
}

export async function syncAliExpressPrices() {
  const { runAliExpressSync } = await import("./scheduler");
  return runAliExpressSync("prices");
}

export async function syncAliExpressStock() {
  const { runAliExpressSync } = await import("./scheduler");
  return runAliExpressSync("stock");
}

export async function syncAliExpressImages() {
  const { runAliExpressSync } = await import("./scheduler");
  return runAliExpressSync("images");
}

export async function runAliExpressFullSync() {
  const { runAliExpressSync } = await import("./scheduler");
  return runAliExpressSync("full");
}
