import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] = val;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.vercel.production"));

const appId = process.env.EBAY_APP_ID ?? process.env.EBAY_Client_ID ?? "";
const certId = process.env.EBAY_CERT_ID ?? "";

console.log("Vercel production eBay env:");
console.log({
  EBAY_APP_ID: Boolean(appId),
  EBAY_CERT_ID: Boolean(certId),
  EBAY_Client_ID: Boolean(process.env.EBAY_Client_ID),
  EBAY_CAMPAIGN_ID: Boolean(process.env.EBAY_CAMPAIGN_ID),
  sandboxAutoDetect: appId.includes("-SBX-") || certId.startsWith("SBX-"),
  productionKeyHint: appId.includes("-PRD-") || certId.startsWith("PRD-"),
});

const { isEbaySandboxMode, getEbayBrowseApiBase } = await import("@/lib/integrations/ebay/config");
const { createEbayClientFromEnv } = await import("@/lib/integrations/ebay");
const { normalizeEbayRaw } = await import("@/lib/search/normalization");

console.log("\nRuntime mode:");
console.log({
  sandboxMode: isEbaySandboxMode(),
  browseApi: getEbayBrowseApiBase(),
});

const client = createEbayClientFromEnv();
if (!client) {
  console.log("FAIL: eBay client not created");
  process.exit(1);
}

const validation = await client.validateCredentials();
console.log("\nOAuth:", validation.ok ? "OK" : "FAIL", validation.message);

for (const q of ["iPhone 16", "Samsung Galaxy", "PlayStation 5", "Nike Air Max"]) {
  const raw = await client.searchByKeyword(q, { pageSize: 50, maxPages: 2 });
  const normalized = raw.filter((item) => normalizeEbayRaw(item));
  console.log(`${q}: raw=${raw.length} normalized=${normalized.length}`);
}
