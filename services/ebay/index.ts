export { loadEbayCredentials, getEbayStatus, validateEbayCredentials } from "./credentials";
export {
  logEbayImportEvent,
  getEbayImportEventLogs,
  getEbaySyncSummary,
} from "./monitoring";
export { runEbaySync, runEbayScheduledSync } from "./scheduler";
export {
  generateEbayAffiliateLink,
  generateEbayAffiliateLinks,
  type EbayAffiliateLinkInput,
  type EbayAffiliateLinkResult,
} from "./affiliate-links";

export async function importEbayProducts() {
  const { runEbaySync } = await import("./scheduler");
  return runEbaySync("products");
}

export async function syncEbayPrices() {
  const { runEbaySync } = await import("./scheduler");
  return runEbaySync("prices");
}

export async function syncEbayStock() {
  const { runEbaySync } = await import("./scheduler");
  return runEbaySync("stock");
}

export async function syncEbayImages() {
  const { runEbaySync } = await import("./scheduler");
  return runEbaySync("images");
}

export async function runEbayFullSync() {
  const { runEbaySync } = await import("./scheduler");
  return runEbaySync("full");
}
