#!/usr/bin/env node
/**
 * Verify admin credentials can sign in and have is_admin=true.
 * Usage: node scripts/verify-admin-login.mjs <email> <password>
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("Usage: node scripts/verify-admin-login.mjs <email> <password>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
});

if (authError) {
  console.log(JSON.stringify({ ok: false, step: "signIn", error: authError.message }, null, 2));
  process.exit(1);
}

const userId = authData.user?.id;
const { data: profile, error: profileError } = await supabase
  .from("profiles")
  .select("email, is_admin, name")
  .eq("id", userId)
  .maybeSingle();

if (profileError || !profile) {
  console.log(
    JSON.stringify(
      { ok: false, step: "profile", error: profileError?.message ?? "Profile not found" },
      null,
      2
    )
  );
  process.exit(1);
}

await supabase.auth.signOut();

const result = {
  ok: profile.is_admin === true,
  email: profile.email,
  isAdmin: profile.is_admin,
  name: profile.name,
  userId,
  loginPage: "http://localhost:3000/admin/login",
};

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
