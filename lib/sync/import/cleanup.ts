import type { SupabaseDb } from "@/lib/supabase/config";

/** Seed/demo product slugs that must not appear on the live catalog. */
export const PLACEHOLDER_PRODUCT_SLUGS = [
  "iphone-15-pro-max",
  "macbook-air-m3",
  "playstation-5",
  "nike-air-jordan-1",
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(client: SupabaseDb): any {
  return client;
}

/** Deactivate seed, demo, and locally-imaged placeholder products. */
export async function deactivatePlaceholderProducts(
  supabase: SupabaseDb
): Promise<{ deactivated: number }> {
  const [{ data: bySlug }, { data: byImage }, { data: byIdle }] = await Promise.all([
    db(supabase).from("products").select("id").in("slug", [...PLACEHOLDER_PRODUCT_SLUGS]),
    db(supabase)
      .from("products")
      .select("id")
      .eq("sync_status", "idle")
      .like("image_url", "/products/%"),
    db(supabase)
      .from("products")
      .select("id")
      .eq("sync_status", "idle")
      .is("last_synced_at", null),
  ]);

  const idSet = new Set<string>();
  for (const row of [...(bySlug ?? []), ...(byImage ?? []), ...(byIdle ?? [])]) {
    idSet.add(row.id);
  }

  const ids = [...idSet];
  if (ids.length === 0) return { deactivated: 0 };

  await db(supabase).from("deals").update({ is_active: false }).in("product_id", ids);
  await db(supabase).from("products").update({ is_active: false }).in("id", ids);

  return { deactivated: ids.length };
}
