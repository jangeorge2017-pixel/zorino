import type { Database } from "@/lib/database/types";
import type { SupabaseDb } from "@/lib/supabase/config";

type TableName = keyof Database["public"]["Tables"];
type RowFor<T extends TableName> = Database["public"]["Tables"][T]["Row"];
type InsertFor<T extends TableName> = Database["public"]["Tables"][T]["Insert"];
type UpdateFor<T extends TableName> = Database["public"]["Tables"][T]["Update"];

/** Typed table writes — avoids PostgREST mutation generic inference edge cases. */
export async function insertRow<T extends TableName>(
  client: SupabaseDb,
  table: T,
  payload: InsertFor<T>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client.from(table) as any).insert(payload).select("*").maybeSingle() as Promise<{
    data: RowFor<T> | null;
    error: { message: string } | null;
  }>;
}

export async function updateRow<T extends TableName>(
  client: SupabaseDb,
  table: T,
  payload: UpdateFor<T>,
  match: Record<string, string>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from(table) as any).update(payload);
  for (const [column, value] of Object.entries(match)) {
    query = query.eq(column, value);
  }
  return query.select("*").maybeSingle() as Promise<{
    data: RowFor<T> | null;
    error: { message: string } | null;
  }>;
}

export async function deleteRows<T extends TableName>(
  client: SupabaseDb,
  table: T,
  match: Record<string, string>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (client.from(table) as any).delete();
  for (const [column, value] of Object.entries(match)) {
    query = query.eq(column, value);
  }
  return query as Promise<{ error: { message: string } | null }>;
}
