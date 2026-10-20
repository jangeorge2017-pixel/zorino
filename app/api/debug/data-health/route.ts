import { NextResponse } from "next/server";
import { authorizeCronRequest, cronUnauthorizedResponse } from "@/lib/security/cron-auth";
import { supabaseUrl, isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAnonClient } from "@/lib/supabase/server";
import { PRODUCTION_PROVIDER_IDS } from "@/lib/integration/constants";
import {
  isProductionProviderConfigured,
  isProductionProviderActive,
} from "@/lib/integration/provider-config";
import { getCatalogStats } from "@/services/stats";

export const dynamic = "force-dynamic";

type Probe = { count: number | null; error: string | null };

async function headCount(
  supabase: NonNullable<ReturnType<typeof createSupabaseAnonClient>>,
  table: string,
): Promise<Probe> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });
  return { count: error ? null : count ?? 0, error: error?.message ?? null };
}

/**
 * Read-only connectivity diagnostic for the data layer.
 *
 * Answers the question the UI cannot: is the deployed build actually reaching
 * the production Supabase project, and — if it is — why do the homepage counts
 * still read 0? The counters in `services/stats.ts` short-circuit on provider
 * credential gates before any row is read, so a healthy database can still
 * surface as "0 products". This endpoint reports both halves independently.
 *
 * Auth: CRON_SECRET bearer, same as the cron routes. Never returns any secret
 * value — only whether a given key is present.
 */
export async function GET(request: Request) {
  if (!authorizeCronRequest(request)) return cronUnauthorizedResponse();

  // Best-effort hydration of DB-stored credentials (integration_settings).
  // Empty table is normal; a failure here must not mask the rest of the report.
  let hydration: string = "ok";
  try {
    const { hydrateIntegrationCredentials } = await import(
      "@/lib/integration/credentials"
    );
    await hydrateIntegrationCredentials();
  } catch (err) {
    hydration = err instanceof Error ? err.message : String(err);
  }

  const supabase = createSupabaseAnonClient();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let host: string | null = null;
  try {
    host = supabaseUrl ? new URL(supabaseUrl).host : null;
  } catch {
    host = null;
  }

  const providers = PRODUCTION_PROVIDER_IDS.map((providerId) => ({
    id: providerId,
    configured: isProductionProviderConfigured(providerId),
    active: isProductionProviderActive(providerId),
  }));

  const db: Record<string, Probe> = {};
  if (supabase) {
    db.lowest_prices_today = await headCount(supabase, "lowest_prices_today");
    db.stores = await headCount(supabase, "stores");
    db.deals = await headCount(supabase, "deals");
  }

  let catalogStats: unknown = null;
  let catalogStatsError: string | null = null;
  try {
    const result = await getCatalogStats();
    catalogStats = result.data;
    catalogStatsError = result.error;
  } catch (err) {
    catalogStatsError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    build: {
      nodeEnv: process.env.NODE_ENV ?? null,
      // Runtime values, i.e. what the Docker container actually has — not what
      // was inlined at build time. A mismatch here means the image is stale.
      runtimeSupabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? null,
    },
    supabase: {
      configured: isSupabaseConfigured(),
      host,
      anonKeyPresent: Boolean(anonKey),
      anonKeyLength: anonKey?.length ?? 0,
      // Presence only — never the value.
      serviceRoleKeyPresent: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      credentialHydration: hydration,
    },
    providers: {
      configured: providers.filter((p) => p.configured).map((p) => p.id),
      active: providers.filter((p) => p.active).map((p) => p.id),
      detail: providers,
    },
    db,
    catalogStats,
    catalogStatsError,
  });
}
