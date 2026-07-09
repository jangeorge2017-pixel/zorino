import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!url || !key) {
  console.log(JSON.stringify({ supabaseQueryable: false }));
  process.exit(0);
}

const res = await fetch(
  `${url}/rest/v1/integration_settings?select=key,value&key=in.(ALIEXPRESS_APP_KEY,ALIEXPRESS_APP_SECRET)`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } }
);

if (!res.ok) {
  console.log(JSON.stringify({ supabaseQueryable: false, status: res.status }));
  process.exit(0);
}

const rows = await res.json();
console.log(
  JSON.stringify(
    {
      supabaseQueryable: true,
      integration_settings: rows.map((r) => ({
        key: r.key,
        status: r.value?.trim() ? "SET" : "EMPTY",
        len: r.value?.trim()?.length ?? 0,
      })),
      note: "hydrateIntegrationCredentials only fills process.env when env var is empty",
    },
    null,
    2
  )
);
