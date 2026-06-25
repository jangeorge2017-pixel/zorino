import { PROVIDER_CREDENTIAL_KEYS } from "@/lib/sync/config";
import type { ImportProviderId } from "@/lib/sync/providers/types";
import { checkProviderCredentials } from "@/lib/sync/providers/types";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export type ProviderIntegrationStatus = {
  id: ImportProviderId;
  name: string;
  phase: "placeholder" | "live";
  configured: boolean;
  missingCredentials: string[];
  optionalCredentials: string[];
  externalProductCount: number;
  lastSyncAt: string | null;
  mode: "live" | "mock" | "idle";
};

export type ImportIntegrationReport = {
  generatedAt: string;
  providers: ProviderIntegrationStatus[];
  totals: {
    externalProducts: number;
    canonicalProducts: number;
    productImages: number;
  };
  credentialsRequired: string[];
};

const OPTIONAL_CREDENTIALS: Partial<Record<ImportProviderId, string[]>> = {
  aliexpress: ["ALIEXPRESS_TRACKING_ID"],
  ebay: ["EBAY_CAMPAIGN_ID", "EBAY_OAUTH_TOKEN"],
};

const PHASE1_META: Record<
  ImportProviderId,
  { name: string; phase: "live" | "placeholder" }
> = {
  aliexpress: { name: "AliExpress", phase: "live" },
  ebay: { name: "eBay", phase: "live" },
  cjdropshipping: { name: "CJdropshipping", phase: "live" },
  amazon: { name: "Amazon", phase: "placeholder" },
  temu: { name: "Temu", phase: "placeholder" },
  walmart: { name: "Walmart", phase: "placeholder" },
};

const LIVE_ONLY_PROVIDERS = new Set<ImportProviderId>(["aliexpress", "ebay"]);

const PHASE1_PROVIDERS: ImportProviderId[] = ["aliexpress", "ebay", "cjdropshipping"];

/** Build integration status report for Phase 1 import providers. */
export async function buildImportIntegrationReport(): Promise<ImportIntegrationReport> {
  const supabase = createSupabaseServiceClient();
  const providerRows: ProviderIntegrationStatus[] = [];

  for (const id of PHASE1_PROVIDERS) {
    const credKeys = [
      ...(PROVIDER_CREDENTIAL_KEYS[id as keyof typeof PROVIDER_CREDENTIAL_KEYS] ?? []),
    ];
    const creds = checkProviderCredentials(credKeys);
    const optional = OPTIONAL_CREDENTIALS[id] ?? [];
    const configured =
      id === "ebay" && process.env.EBAY_OAUTH_TOKEN?.trim()
        ? true
        : creds.configured;

    let externalProductCount = 0;
    let lastSyncAt: string | null = null;

    if (supabase) {
      const { count } = await supabase
        .from("external_products")
        .select("*", { count: "exact", head: true })
        .eq("provider", id);

      externalProductCount = count ?? 0;

      const { data: store } = await supabase
        .from("stores")
        .select("last_sync_at")
        .eq("integration_type", id)
        .order("last_sync_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      lastSyncAt = (store as { last_sync_at?: string } | null)?.last_sync_at ?? null;
    }

    const meta = PHASE1_META[id];

    providerRows.push({
      id,
      name: meta.name,
      phase: meta.phase,
      configured,
      missingCredentials: configured ? [] : creds.missingKeys,
      optionalCredentials: optional.filter((k) => !process.env[k]?.trim()),
      externalProductCount,
      lastSyncAt,
      mode: configured ? "live" : LIVE_ONLY_PROVIDERS.has(id) ? "idle" : "mock",
    });
  }

  let externalProducts = 0;
  let canonicalProducts = 0;
  let productImages = 0;

  if (supabase) {
    const [ext, prod, imgs] = await Promise.all([
      supabase.from("external_products").select("*", { count: "exact", head: true }).in("provider", PHASE1_PROVIDERS),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase.from("product_images").select("*", { count: "exact", head: true }),
    ]);
    externalProducts = ext.count ?? 0;
    canonicalProducts = prod.count ?? 0;
    productImages = imgs.count ?? 0;
  }

  const credentialsRequired = [
    ...new Set(providerRows.flatMap((p) => p.missingCredentials)),
    ...new Set(providerRows.flatMap((p) => p.optionalCredentials)),
  ];

  return {
    generatedAt: new Date().toISOString(),
    providers: providerRows,
    totals: { externalProducts, canonicalProducts, productImages },
    credentialsRequired,
  };
}

export function formatImportIntegrationReport(report: ImportIntegrationReport): string {
  const lines: string[] = [
    "Zorino Phase 1 — Product Import Integration Report",
    `Generated: ${report.generatedAt}`,
    "",
    "Providers:",
  ];

  for (const p of report.providers) {
    lines.push(`  ${p.name} (${p.id})`);
    lines.push(`    Status: ${p.phase} · mode=${p.mode} · configured=${p.configured}`);
    lines.push(`    External products in DB: ${p.externalProductCount}`);
    lines.push(`    Last sync: ${p.lastSyncAt ?? "never"}`);
    if (p.missingCredentials.length) {
      lines.push(`    Required credentials: ${p.missingCredentials.join(", ")}`);
    }
    if (p.optionalCredentials.length) {
      lines.push(`    Optional (affiliate): ${p.optionalCredentials.join(", ")}`);
    }
  }

  lines.push("");
  lines.push("Totals:");
  lines.push(`  External products (Phase 1): ${report.totals.externalProducts}`);
  lines.push(`  Canonical products: ${report.totals.canonicalProducts}`);
  lines.push(`  Product images: ${report.totals.productImages}`);

  if (report.credentialsRequired.length) {
    lines.push("");
    lines.push("Credentials still needed:");
    for (const key of report.credentialsRequired) {
      lines.push(`  - ${key}`);
    }
  } else {
    lines.push("");
    lines.push("All required credentials are configured.");
  }

  return lines.join("\n");
}
