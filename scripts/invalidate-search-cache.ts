#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path: string): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          version: null,
          deletedRows: 0,
          error: "search cache invalidation skipped: Supabase credentials unavailable",
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const version = `v3-${Date.now()}`;
  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: settingError } = await db.from("integration_settings").upsert(
    {
      key: "search_cache_version",
      value: version,
      provider: "search",
      label: "Search cache epoch",
      is_secret: false,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (settingError) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          version: null,
          deletedRows: 0,
          error: `search cache version write failed: ${settingError.message}`,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const { data, error } = await db
    .from("search_result_cache")
    .delete()
    .not("cache_key", "is", null)
    .select("cache_key");
  const deletedRows = data?.length ?? 0;
  const result = {
    ok: !error,
    version,
    deletedRows,
    error: error ? `search cache row delete failed: ${error.message}` : null,
  };
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ok ? 0 : 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
