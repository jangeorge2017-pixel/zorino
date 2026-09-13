/**
 * Identity persistence — Phase 3.
 *
 * A canonical identity map (existing external ref → deterministic canonical
 * product/offer ids) for products already in the runtime. The production
 * backing table is `canonical_identity_map` (migration 025) which is NOT
 * applied anywhere yet. Every canonical-store implementation is drop-in so
 * the bootstrap/backfill code is tested against in-memory and local-file
 * targets (safe non-production targets) and only optionally reaches Supabase
 * from an explicit, credentialed client.
 */

import type { MatchConfidence } from "@/lib/canonical/types";

export type IdentitySource = "lowest_prices_today" | "external_products" | "search_listing";

export interface CanonicalIdentityRecord {
  id?: string;
  source: IdentitySource;
  providerId: string;
  externalId: string;
  storeName?: string;
  countryCode?: string;
  currency?: string;
  canonicalProductId: string;
  canonicalOfferId: string;
  confidence: MatchConfidence;
  /** Field-level identifiers that were grounded (never invented). */
  identifiers: string[];
  titleKey?: string;
  title?: string;
  createdAt?: string;
}

export type CreateIdentityRecord = Omit<CanonicalIdentityRecord, "id" | "createdAt">;

export interface CanonicalIdentityStore {
  readonly kind: string;
  writeMany(records: readonly CreateIdentityRecord[]): Promise<number>;
  getByExternalId(source: IdentitySource, providerId: string, externalId: string): Promise<CanonicalIdentityRecord | null>;
  count(): Promise<number>;
}

/** No-op store used while ARCH_CANONICAL=off (default). Discards everything. */
export class NoopCanonicalIdentityStore implements CanonicalIdentityStore {
  readonly kind = "noop";
  async writeMany(_records: readonly CreateIdentityRecord[]): Promise<number> {
    void _records;
    return 0;
  }
  async getByExternalId(
    _source: IdentitySource,
    _providerId: string,
    _externalId: string,
  ): Promise<CanonicalIdentityRecord | null> {
    void _source;
    void _providerId;
    void _externalId;
    return null;
  }
  async count(): Promise<number> {
    return 0;
  }
}

/** In-memory store for tests / local processors. */
export class InMemoryCanonicalIdentityStore implements CanonicalIdentityStore {
  readonly kind = "memory";
  private rows: CanonicalIdentityRecord[] = [];

  async writeMany(records: readonly CreateIdentityRecord[]): Promise<number> {
    let written = 0;
    for (const r of records) {
      const key = this.externalKey(r.source, r.providerId, r.externalId);
      if (this.rows.some((x) => this.externalKey(x.source, x.providerId, x.externalId) === key)) {
        continue;
      }
      this.rows.push({
        ...r,
        id: async_id(),
        createdAt: new Date().toISOString(),
      });
      written += 1;
    }
    return written;
  }

  async getByExternalId(
    source: IdentitySource,
    providerId: string,
    externalId: string,
  ): Promise<CanonicalIdentityRecord | null> {
    const key = this.externalKey(source, providerId, externalId);
    return this.rows.find((r) => this.externalKey(r.source, r.providerId, r.externalId) === key) ?? null;
  }

  async count(): Promise<number> {
    return this.rows.length;
  }

  all(): CanonicalIdentityRecord[] {
    return [...this.rows];
  }

  private externalKey(source: string, providerId: string, externalId: string): string {
    return `${source}\u0000${providerId}\u0000${externalId}`;
  }
}

let idCounter = 0;
function async_id(): string {
  idCounter += 1;
  return `im-${Date.now().toString(36)}-${idCounter}`;
}

/**
 * Local JSON-lines store — a SAFE non-production target for backfills. Each
 * record is appended as one line to `filePath`. Never touches any database.
 */
export class LocalJsonIdentityStore implements CanonicalIdentityStore {
  readonly kind = "file";
  readonly filePath: string;
  private lines: CanonicalIdentityRecord[] = [];

  constructor(filePath: string) {
    this.filePath = filePath;
  }

  async writeMany(records: readonly CreateIdentityRecord[]): Promise<number> {
    const existing = new Set(this.lines.map((r) => this.externalKey(r)));
    let written = 0;
    const additions: CanonicalIdentityRecord[] = [];
    for (const r of records) {
      const key = this.externalKey(r);
      if (existing.has(key)) continue;
      existing.add(key);
      const full: CanonicalIdentityRecord = {
        ...r,
        id: `file-${written}-${Math.random().toString(36).slice(2, 8)}`,
        createdAt: new Date().toISOString(),
      };
      this.lines.push(full);
      additions.push(full);
      written += 1;
    }
    if (additions.length > 0) {
      // lazy import keeps this module dependency-free when used server-side
      const fs = await import("node:fs");
      const file = await import("node:path");
      const dir = file.dirname(this.filePath);
      if (dir && !fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(this.filePath, additions.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf8");
    }
    return written;
  }

  async getByExternalId(
    source: IdentitySource,
    providerId: string,
    externalId: string,
  ): Promise<CanonicalIdentityRecord | null> {
    return this.lines.find(
      (r) => r.source === source && r.providerId === providerId && r.externalId === externalId,
    ) ?? null;
  }

  async count(): Promise<number> {
    return this.lines.length;
  }

  private externalKey(r: CanonicalIdentityRecord | CreateIdentityRecord): string {
    return `${r.source}\u0000${r.providerId}\u0000${r.externalId}`;
  }
}

/** Minimal structural client — accepts any supabase-js / custom client. */
export interface SupabaseQueryBuilder {
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  single(): Promise<{ data: unknown | null; error: unknown | null }>;
}

export interface SupabaseLikeClient {
  from(table: string): {
    insert(rows: unknown): Promise<{ error: unknown | null }>;
    select(columns: string): SupabaseQueryBuilder;
  };
}

/**
 * Supabase-backed store (table `canonical_identity_map`). OPT-IN ONLY: it
 * requires an explicit credentialed client and will return 0 / null silently
 * on any error, so an unprovisioned backfill can never corrupt the runtime.
 */
export class SupabaseCanonicalIdentityStore implements CanonicalIdentityStore {
  readonly kind = "supabase";
  readonly table = "canonical_identity_map";
  private client: SupabaseLikeClient;

  constructor(client: SupabaseLikeClient) {
    this.client = client;
  }

  async writeMany(records: readonly CreateIdentityRecord[]): Promise<number> {
    if (records.length === 0) return 0;
    const rows = records.map((r) => ({
      source: r.source,
      provider_id: r.providerId,
      external_id: r.externalId,
      store_name: r.storeName ?? null,
      country_code: r.countryCode ?? null,
      currency: r.currency ?? null,
      canonical_product_id: r.canonicalProductId,
      canonical_offer_id: r.canonicalOfferId,
      confidence: r.confidence,
      identifiers: r.identifiers,
      title_key: r.titleKey ?? null,
      title: r.title ?? null,
    }));
    const { error } = await this.client.from(this.table).insert(rows);
    if (error) return 0;
    return rows.length;
  }

  async getByExternalId(
    source: IdentitySource,
    providerId: string,
    externalId: string,
  ): Promise<CanonicalIdentityRecord | null> {
    const { data } = await this.client
      .from(this.table)
      .select("source,provider_id,external_id,store_name,country_code,currency,canonical_product_id,canonical_offer_id,confidence,identifiers,title_key,title,created_at")
      .eq("source", source)
      .eq("provider_id", providerId)
      .eq("external_id", externalId)
      .single();
    return data as CanonicalIdentityRecord | null;
  }

  async count(): Promise<number> {
    return 0;
  }
}

export type IdentityStoreTarget = "noop" | "memory" | "file" | "supabase";

export interface IdentityStoreOptions {
  filePath?: string;
  supabaseClient?: SupabaseLikeClient;
}

/**
 * Flag-aware store factory. With ARCH_CANONICAL=off (default) this always
 * returns the Noop store so the backfill wiring stays dormant at runtime.
 */
export function createIdentityStore(target?: IdentityStoreTarget, options?: IdentityStoreOptions): CanonicalIdentityStore {
  const resolved = target ?? "noop";
  switch (resolved) {
    case "memory":
      return new InMemoryCanonicalIdentityStore();
    case "file":
      if (!options?.filePath) throw new Error("createIdentityStore('file') requires options.filePath");
      return new LocalJsonIdentityStore(options.filePath);
    case "supabase":
      if (!isCanonicalIdentityEnabled_()) return new NoopCanonicalIdentityStore();
      if (!options?.supabaseClient) return new NoopCanonicalIdentityStore();
      return new SupabaseCanonicalIdentityStore(options.supabaseClient);
    case "noop":
    default:
      return new NoopCanonicalIdentityStore();
  }
}

// ARCH_CANONICAL gate — consistent with lib/canonical/feature.ts semantics.
// Re-checks process env synchronously so tests can flip it.
function isCanonicalIdentityEnabled_(): boolean {
  try {
    const val = (process.env.ARCH_CANONICAL ?? "").trim().toLowerCase();
    return val === "on" || val === "1" || val === "true";
  } catch {
    return false;
  }
}