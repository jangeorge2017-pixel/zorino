/**
 * Supabase PostgreSQL schema types for Zorino.
 * Mirrors supabase/migrations/001_zorino_foundation.sql
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type DiscountType = "percentage" | "fixed";
export type StoreIntegrationType =
  | "amazon"
  | "aliexpress"
  | "cjdropshipping"
  | "ebay"
  | "shopify"
  | "noon"
  | "walmart"
  | "custom"
  | "partner";
export type NotificationType = "price_drop" | "coupon" | "deal" | "system" | "review" | "alert";

export interface Database {
  public: {
    Tables: {
      countries: {
        Row: {
          code: string;
          name: string;
          name_ar: string | null;
          default_currency: string;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          code: string;
          name: string;
          name_ar?: string | null;
          default_currency: string;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["countries"]["Insert"]>;
      };
      currencies: {
        Row: {
          code: string;
          name: string;
          symbol: string;
          decimal_places: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          code: string;
          name: string;
          symbol: string;
          decimal_places?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["currencies"]["Insert"]>;
      };
      profiles: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          avatar_url: string | null;
          locale: string;
          country_code: string | null;
          currency: string;
          is_verified: boolean;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
          last_login_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          country_code?: string | null;
          currency?: string;
          is_verified?: boolean;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          country_code?: string | null;
          currency?: string;
          is_verified?: boolean;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
          last_login_at?: string | null;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          name: string;
          name_ar: string | null;
          slug: string;
          logo_url: string | null;
          logo_initial: string | null;
          website: string;
          integration_type: StoreIntegrationType;
          affiliate_program: string | null;
          commission_rate: number;
          supported_regions: string[];
          supported_currencies: string[];
          external_store_id: string | null;
          api_config: Json | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_ar?: string | null;
          slug: string;
          logo_url?: string | null;
          logo_initial?: string | null;
          website: string;
          integration_type?: StoreIntegrationType;
          affiliate_program?: string | null;
          commission_rate?: number;
          supported_regions?: string[];
          supported_currencies?: string[];
          external_store_id?: string | null;
          api_config?: Json | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["stores"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          name: string;
          name_ar: string | null;
          slug: string;
          description: string | null;
          description_ar: string | null;
          image_url: string;
          emoji: string | null;
          category_slug: string | null;
          brand: string | null;
          rating: number | null;
          review_count: number;
          currency: string;
          country_code: string | null;
          in_stock: boolean;
          specifications: Json | null;
          tags: string[];
          is_active: boolean;
          category_id: string | null;
          last_synced_at: string | null;
          sync_status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          name_ar?: string | null;
          slug: string;
          description?: string | null;
          description_ar?: string | null;
          image_url: string;
          emoji?: string | null;
          category_slug?: string | null;
          brand?: string | null;
          rating?: number | null;
          review_count?: number;
          currency?: string;
          country_code?: string | null;
          in_stock?: boolean;
          specifications?: Json | null;
          tags?: string[];
          is_active?: boolean;
          category_id?: string | null;
          last_synced_at?: string | null;
          sync_status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      prices: {
        Row: {
          id: string;
          product_id: string;
          store_id: string;
          price: number;
          original_price: number | null;
          currency: string;
          country_code: string | null;
          external_url: string | null;
          external_product_id: string | null;
          in_stock: boolean;
          is_current: boolean;
          recorded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          store_id: string;
          price: number;
          original_price?: number | null;
          currency?: string;
          country_code?: string | null;
          external_url?: string | null;
          external_product_id?: string | null;
          in_stock?: boolean;
          is_current?: boolean;
          recorded_at?: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["prices"]["Insert"]>;
      };
      price_history: {
        Row: {
          id: string;
          product_id: string;
          store_id: string | null;
          price: number;
          currency: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          store_id?: string | null;
          price: number;
          currency?: string;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["price_history"]["Insert"]>;
      };
      deals: {
        Row: {
          id: string;
          product_id: string | null;
          store_id: string | null;
          title: string;
          title_ar: string | null;
          description: string | null;
          discount: number;
          discount_type: DiscountType;
          price: number;
          original_price: number;
          currency: string;
          country_code: string | null;
          is_featured: boolean;
          is_active: boolean;
          sort_order: number;
          starts_at: string;
          ends_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          store_id?: string | null;
          title: string;
          title_ar?: string | null;
          description?: string | null;
          discount: number;
          discount_type?: DiscountType;
          price: number;
          original_price: number;
          currency?: string;
          country_code?: string | null;
          is_featured?: boolean;
          is_active?: boolean;
          sort_order?: number;
          starts_at?: string;
          ends_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Insert"]>;
      };
      coupons: {
        Row: {
          id: string;
          store_id: string;
          code: string;
          title: string;
          title_ar: string | null;
          offer: string;
          min_spend: string | null;
          discount: number;
          discount_type: DiscountType;
          currency: string;
          country_code: string | null;
          used_times: number;
          max_usage: number | null;
          verified: boolean;
          is_active: boolean;
          starts_at: string;
          ends_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          code: string;
          title: string;
          title_ar?: string | null;
          offer: string;
          min_spend?: string | null;
          discount: number;
          discount_type?: DiscountType;
          currency?: string;
          country_code?: string | null;
          used_times?: number;
          max_usage?: number | null;
          verified?: boolean;
          is_active?: boolean;
          starts_at?: string;
          ends_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["coupons"]["Insert"]>;
      };
      favorites: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          price_alert: number | null;
          currency: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          price_alert?: number | null;
          currency?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          price_alert?: number | null;
          currency?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: NotificationType;
          title: string;
          title_ar: string | null;
          message: string;
          message_ar: string | null;
          link: string | null;
          data: Json | null;
          read: boolean;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: NotificationType;
          title: string;
          title_ar?: string | null;
          message: string;
          message_ar?: string | null;
          link?: string | null;
          data?: Json | null;
          read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: NotificationType;
          title?: string;
          title_ar?: string | null;
          message?: string;
          message_ar?: string | null;
          link?: string | null;
          data?: Json | null;
          read?: boolean;
          created_at?: string;
          read_at?: string | null;
        };
        Relationships: [];
      };
      categories: {
        Row: {
          id: string;
          slug: string;
          name: string;
          name_ar: string | null;
          description: string | null;
          icon: string | null;
          parent_id: string | null;
          sort_order: number;
          product_count: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          name_ar?: string | null;
          description?: string | null;
          icon?: string | null;
          parent_id?: string | null;
          sort_order?: number;
          product_count?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["categories"]["Insert"]>;
        Relationships: [];
      };
      product_images: {
        Row: {
          id: string;
          product_id: string;
          url: string;
          alt_text: string | null;
          is_primary: boolean;
          sort_order: number;
          source: string;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          url: string;
          alt_text?: string | null;
          is_primary?: boolean;
          sort_order?: number;
          source?: string;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_images"]["Insert"]>;
        Relationships: [];
      };
      product_sources: {
        Row: {
          id: string;
          product_id: string;
          store_id: string;
          external_product_id: string;
          external_url: string | null;
          country_code: string | null;
          currency: string;
          affiliate_url: string | null;
          sync_hash: string | null;
          raw_payload: Json | null;
          last_synced_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          store_id: string;
          external_product_id: string;
          external_url?: string | null;
          country_code?: string | null;
          currency?: string;
          affiliate_url?: string | null;
          sync_hash?: string | null;
          raw_payload?: Json | null;
          last_synced_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_sources"]["Insert"]>;
        Relationships: [];
      };
      sync_jobs: {
        Row: {
          id: string;
          store_id: string | null;
          job_type: string;
          country_code: string | null;
          currency: string | null;
          schedule_cron: string | null;
          interval_minutes: number;
          is_enabled: boolean;
          priority: number;
          last_run_at: string | null;
          next_run_at: string | null;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id?: string | null;
          job_type: string;
          country_code?: string | null;
          currency?: string | null;
          schedule_cron?: string | null;
          interval_minutes?: number;
          is_enabled?: boolean;
          priority?: number;
          last_run_at?: string | null;
          next_run_at?: string | null;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["sync_jobs"]["Insert"]>;
        Relationships: [];
      };
      sync_runs: {
        Row: {
          id: string;
          sync_job_id: string | null;
          store_id: string | null;
          job_type: string;
          status: string;
          country_code: string | null;
          currency: string | null;
          started_at: string;
          finished_at: string | null;
          items_fetched: number;
          items_created: number;
          items_updated: number;
          items_failed: number;
          error_message: string | null;
          metadata: Json;
        };
        Insert: {
          id?: string;
          sync_job_id?: string | null;
          store_id?: string | null;
          job_type: string;
          status?: string;
          country_code?: string | null;
          currency?: string | null;
          started_at?: string;
          finished_at?: string | null;
          items_fetched?: number;
          items_created?: number;
          items_updated?: number;
          items_failed?: number;
          error_message?: string | null;
          metadata?: Json;
        };
        Update: Partial<Database["public"]["Tables"]["sync_runs"]["Insert"]>;
        Relationships: [];
      };
      import_providers: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          integration_type: string;
          is_enabled: boolean;
          requires_credentials: boolean;
          credential_env_keys: string[];
          default_sync_interval_minutes: number;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description?: string | null;
          integration_type: string;
          is_enabled?: boolean;
          requires_credentials?: boolean;
          credential_env_keys?: string[];
          default_sync_interval_minutes?: number;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["import_providers"]["Insert"]>;
        Relationships: [];
      };
      external_products: {
        Row: {
          id: string;
          provider: string;
          store_id: string;
          external_id: string;
          canonical_product_id: string | null;
          title: string;
          title_ar: string | null;
          slug: string;
          description: string | null;
          brand: string | null;
          category_slug: string | null;
          image_url: string;
          image_urls: Json;
          emoji: string | null;
          specifications: Json | null;
          tags: string[];
          rating: number | null;
          review_count: number;
          currency: string;
          country_code: string | null;
          product_url: string | null;
          affiliate_url: string | null;
          in_stock: boolean;
          sync_hash: string | null;
          sync_status: string;
          raw_payload: Json | null;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          store_id: string;
          external_id: string;
          canonical_product_id?: string | null;
          title: string;
          title_ar?: string | null;
          slug: string;
          description?: string | null;
          brand?: string | null;
          category_slug?: string | null;
          image_url: string;
          image_urls?: Json;
          emoji?: string | null;
          specifications?: Json | null;
          tags?: string[];
          rating?: number | null;
          review_count?: number;
          currency?: string;
          country_code?: string | null;
          product_url?: string | null;
          affiliate_url?: string | null;
          in_stock?: boolean;
          sync_hash?: string | null;
          sync_status?: string;
          raw_payload?: Json | null;
          last_synced_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["external_products"]["Insert"]>;
        Relationships: [];
      };
      external_prices: {
        Row: {
          id: string;
          provider: string;
          store_id: string;
          external_product_id: string | null;
          external_id: string;
          canonical_product_id: string | null;
          price: number;
          original_price: number | null;
          currency: string;
          country_code: string | null;
          in_stock: boolean;
          is_current: boolean;
          recorded_at: string;
          merged_at: string | null;
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider: string;
          store_id: string;
          external_product_id?: string | null;
          external_id: string;
          canonical_product_id?: string | null;
          price: number;
          original_price?: number | null;
          currency?: string;
          country_code?: string | null;
          in_stock?: boolean;
          is_current?: boolean;
          recorded_at?: string;
          merged_at?: string | null;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["external_prices"]["Insert"]>;
        Relationships: [];
      };
      product_engagement_events: {
        Row: {
          id: string;
          product_id: string;
          event_type: string;
          country_code: string | null;
          user_id: string | null;
          session_id: string | null;
          source: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          event_type: string;
          country_code?: string | null;
          user_id?: string | null;
          session_id?: string | null;
          source?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_engagement_events"]["Insert"]>;
        Relationships: [];
      };
      product_engagement_daily: {
        Row: {
          product_id: string;
          stat_date: string;
          country_code: string;
          views: number;
          clicks: number;
          favorites: number;
          purchases: number;
          updated_at: string;
        };
        Insert: {
          product_id: string;
          stat_date?: string;
          country_code?: string;
          views?: number;
          clicks?: number;
          favorites?: number;
          purchases?: number;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_engagement_daily"]["Insert"]>;
        Relationships: [];
      };
      trending_rankings: {
        Row: {
          id: string;
          ranking_type: string;
          country_code: string;
          product_id: string;
          rank: number;
          score: number;
          badge: string | null;
          metadata: Json;
          computed_at: string;
        };
        Insert: {
          id?: string;
          ranking_type: string;
          country_code?: string;
          product_id: string;
          rank: number;
          score?: number;
          badge?: string | null;
          metadata?: Json;
          computed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trending_rankings"]["Insert"]>;
        Relationships: [];
      };
      trending_refresh_jobs: {
        Row: {
          id: string;
          interval_minutes: number;
          is_enabled: boolean;
          last_run_at: string | null;
          next_run_at: string | null;
          last_status: string | null;
          last_error: string | null;
          items_ranked: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          interval_minutes?: number;
          is_enabled?: boolean;
          last_run_at?: string | null;
          next_run_at?: string | null;
          last_status?: string | null;
          last_error?: string | null;
          items_ranked?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["trending_refresh_jobs"]["Insert"]>;
        Relationships: [];
      };
      lowest_price_history: {
        Row: {
          id: string;
          product_id: string;
          store_id: string | null;
          provider: string | null;
          price: number;
          previous_lowest: number | null;
          country_code: string | null;
          currency: string;
          recorded_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          store_id?: string | null;
          provider?: string | null;
          price: number;
          previous_lowest?: number | null;
          country_code?: string | null;
          currency?: string;
          recorded_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lowest_price_history"]["Insert"]>;
        Relationships: [];
      };
      lowest_prices_today: {
        Row: {
          id: string;
          product_id: string;
          country_code: string;
          currency: string;
          product_name: string;
          product_slug: string;
          image_url: string;
          emoji: string | null;
          lowest_price: number;
          original_price: number | null;
          discount_percent: number;
          savings_amount: number;
          store_id: string | null;
          store_name: string;
          provider: string | null;
          affiliate_url: string | null;
          external_url: string | null;
          is_new_low: boolean;
          price_recorded_at: string | null;
          computed_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          country_code?: string;
          currency?: string;
          product_name: string;
          product_slug: string;
          image_url: string;
          emoji?: string | null;
          lowest_price: number;
          original_price?: number | null;
          discount_percent?: number;
          savings_amount?: number;
          store_id?: string | null;
          store_name: string;
          provider?: string | null;
          affiliate_url?: string | null;
          external_url?: string | null;
          is_new_low?: boolean;
          price_recorded_at?: string | null;
          computed_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lowest_prices_today"]["Insert"]>;
        Relationships: [];
      };
      lowest_price_refresh_jobs: {
        Row: {
          id: string;
          interval_minutes: number;
          is_enabled: boolean;
          last_run_at: string | null;
          next_run_at: string | null;
          last_status: string | null;
          last_error: string | null;
          items_computed: number;
          triggered_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          interval_minutes?: number;
          is_enabled?: boolean;
          last_run_at?: string | null;
          next_run_at?: string | null;
          last_status?: string | null;
          last_error?: string | null;
          items_computed?: number;
          triggered_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["lowest_price_refresh_jobs"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

/** Convenience row aliases */
export type CountryRow = Database["public"]["Tables"]["countries"]["Row"];
export type CurrencyRow = Database["public"]["Tables"]["currencies"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type PriceRow = Database["public"]["Tables"]["prices"]["Row"];
export type PriceHistoryRow = Database["public"]["Tables"]["price_history"]["Row"];
export type DealRow = Database["public"]["Tables"]["deals"]["Row"];
export type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];
export type FavoriteRow = Database["public"]["Tables"]["favorites"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
export type ImportProviderRow = Database["public"]["Tables"]["import_providers"]["Row"];
export type ExternalProductRow = Database["public"]["Tables"]["external_products"]["Row"];
export type ExternalPriceRow = Database["public"]["Tables"]["external_prices"]["Row"];
export type SyncJobRow = Database["public"]["Tables"]["sync_jobs"]["Row"];
export type SyncRunRow = Database["public"]["Tables"]["sync_runs"]["Row"];
export type LowestPriceTodayRow = Database["public"]["Tables"]["lowest_prices_today"]["Row"];
export type LowestPriceHistoryRow = Database["public"]["Tables"]["lowest_price_history"]["Row"];
