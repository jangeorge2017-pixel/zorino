#!/usr/bin/env node
/**
 * Create or promote a Supabase admin user for Zorino.
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Usage:
 *   npm run admin:create -- admin@zorino.com YourSecurePassword123
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
  console.error("Usage: npm run admin:create -- <email> <password>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listData, error: listError } = await supabase.auth.admin.listUsers();
if (listError) {
  console.error("Failed to list users:", listError.message);
  process.exit(1);
}

let userId = listData.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;

if (!userId) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "Admin" },
  });
  if (error) {
    console.error("Failed to create user:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log(`✓ Created auth user ${email}`);
} else {
  const { error } = await supabase.auth.admin.updateUserById(userId, { password });
  if (error) {
    console.error("Failed to update password:", error.message);
    process.exit(1);
  }
  console.log(`✓ User ${email} already exists — password updated`);
}

const { error: profileError } = await supabase.from("profiles").upsert(
  {
    id: userId,
    email,
    name: "Admin",
    is_admin: true,
    is_verified: true,
  },
  { onConflict: "id" }
);

if (profileError) {
  console.error("Failed to set admin profile:", profileError.message);
  process.exit(1);
}

console.log(`✓ ${email} is now an admin. Sign in at /admin/login`);
