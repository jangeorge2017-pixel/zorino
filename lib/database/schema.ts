// Database Schema
// This file defines the database schema for the ZORINO platform

export interface DatabaseSchema {
  // Users table
  users: {
    id: string;
    email: string;
    password_hash: string;
    name: string;
    avatar_url?: string;
    locale: 'en' | 'ar';
    currency: string;
    is_verified: boolean;
    is_admin: boolean;
    created_at: Date;
    updated_at: Date;
    last_login_at?: Date;
  };

  // User sessions table
  user_sessions: {
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    created_at: Date;
    ip_address?: string;
    user_agent?: string;
  };

  // Categories table
  categories: {
    id: string;
    name: string;
    name_ar?: string;
    slug: string;
    description?: string;
    description_ar?: string;
    icon?: string;
    parent_id?: string;
    product_count: number;
    created_at: Date;
    updated_at: Date;
  };

  // Stores/Marketplaces table
  stores: {
    id: string;
    name: string;
    name_ar?: string;
    slug: string;
    logo?: string;
    website: string;
    api_endpoint?: string;
    affiliate_program: string;
    commission_rate: number;
    supported_regions: string[];
    supported_currencies: string[];
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  };

  // Products table
  products: {
    id: string;
    title: string;
    title_ar?: string;
    description?: string;
    description_ar?: string;
    image_url: string;
    category_id: string;
    store_id: string;
    external_product_id: string;
    external_url: string;
    price: number;
    original_price?: number;
    currency: string;
    rating?: number;
    review_count?: number;
    in_stock: boolean;
    specifications?: Record<string, string>;
    created_at: Date;
    updated_at: Date;
    last_price_check?: Date;
  };

  // Product prices history table
  product_prices: {
    id: string;
    product_id: string;
    price: number;
    currency: string;
    recorded_at: Date;
  };

  // Deals table
  deals: {
    id: string;
    title: string;
    title_ar?: string;
    description?: string;
    description_ar?: string;
    image_url?: string;
    product_id?: string;
    category_id: string;
    store_id: string;
    discount: number;
    discount_type: 'percentage' | 'fixed';
    price: number;
    original_price: number;
    currency: string;
    product_url: string;
    coupon_code?: string;
    terms?: string;
    starts_at: Date;
    ends_at: Date;
    is_active: boolean;
    is_featured: boolean;
    created_at: Date;
    updated_at: Date;
  };

  // Coupons table
  coupons: {
    id: string;
    code: string;
    title: string;
    title_ar?: string;
    description?: string;
    description_ar?: string;
    store_id: string;
    category_id?: string;
    discount: number;
    discount_type: 'percentage' | 'fixed';
    min_purchase?: number;
    max_discount?: number;
    currency: string;
    terms?: string;
    starts_at: Date;
    ends_at: Date;
    usage_count: number;
    max_usage?: number;
    is_active: boolean;
    created_at: Date;
    updated_at: Date;
  };

  // Wishlist table
  wishlist_items: {
    id: string;
    user_id: string;
    product_id: string;
    price_alert?: number;
    added_at: Date;
  };

  // Product comparisons table
  product_comparisons: {
    id: string;
    user_id: string;
    product_ids: string[];
    created_at: Date;
  };

  // Affiliate links table
  affiliate_links: {
    id: string;
    user_id: string;
    product_id: string;
    marketplace: string;
    original_url: string;
    affiliate_url: string;
    tracking_id: string;
    commission_rate: number;
    created_at: Date;
    expires_at?: Date;
  };

  // Affiliate clicks table
  affiliate_clicks: {
    id: string;
    affiliate_link_id: string;
    user_id: string;
    product_id: string;
    marketplace: string;
    ip_address?: string;
    user_agent?: string;
    referrer?: string;
    clicked_at: Date;
    converted: boolean;
    conversion_value?: number;
    commission_earned?: number;
    converted_at?: Date;
  };

  // Affiliate commissions table
  affiliate_commissions: {
    id: string;
    user_id: string;
    affiliate_link_id: string;
    click_id: string;
    product_id: string;
    marketplace: string;
    commission_rate: number;
    sale_amount: number;
    commission_amount: number;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
    created_at: Date;
    approved_at?: Date;
    paid_at?: Date;
  };

  // Notifications table
  notifications: {
    id: string;
    user_id: string;
    type: 'price_drop' | 'coupon' | 'deal' | 'system' | 'review' | 'alert';
    title: string;
    title_ar?: string;
    message: string;
    message_ar?: string;
    data?: Record<string, any>;
    read: boolean;
    created_at: Date;
    read_at?: Date;
  };

  // Blog posts table
  blog_posts: {
    id: string;
    title: string;
    title_ar?: string;
    slug: string;
    excerpt: string;
    excerpt_ar?: string;
    content: string;
    content_ar?: string;
    image_url?: string;
    author: string;
    category: string;
    tags: string[];
    published: boolean;
    published_at?: Date;
    created_at: Date;
    updated_at: Date;
  };

  // Contact messages table
  contact_messages: {
    id: string;
    name: string;
    email: string;
    subject: string;
    message: string;
    status: 'pending' | 'in_progress' | 'resolved';
    created_at: Date;
    updated_at: Date;
  };

  // Newsletter subscribers table
  newsletter_subscribers: {
    id: string;
    email: string;
    name?: string;
    locale: 'en' | 'ar';
    is_active: boolean;
    subscribed_at: Date;
    unsubscribed_at?: Date;
  };

  // Search history table
  search_history: {
    id: string;
    user_id?: string;
    query: string;
    results_count: number;
    searched_at: Date;
  };

  // User preferences table
  user_preferences: {
    id: string;
    user_id: string;
    notifications_enabled: boolean;
    email_notifications: boolean;
    price_alerts: boolean;
    deal_notifications: boolean;
    coupon_notifications: boolean;
    newsletter: boolean;
    created_at: Date;
    updated_at: Date;
  };

  // Reviews table
  reviews: {
    id: string;
    user_id: string;
    product_id: string;
    rating: number;
    title?: string;
    comment: string;
    verified_purchase: boolean;
    helpful_count: number;
    created_at: Date;
    updated_at: Date;
  };

  // Audit log table
  audit_logs: {
    id: string;
    user_id?: string;
    action: string;
    entity_type: string;
    entity_id?: string;
    changes?: Record<string, any>;
    ip_address?: string;
    user_agent?: string;
    created_at: Date;
  };
}

// Migration definitions
export interface Migration {
  version: string;
  name: string;
  up: string;
  down: string;
}

export const migrations: Migration[] = [
  {
    version: '001',
    name: 'create_users_table',
    up: `
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        locale VARCHAR(2) DEFAULT 'en',
        currency VARCHAR(3) DEFAULT 'USD',
        is_verified BOOLEAN DEFAULT FALSE,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP
      );
      
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_locale ON users(locale);
    `,
    down: 'DROP TABLE users;',
  },
  {
    version: '002',
    name: 'create_user_sessions_table',
    up: `
      CREATE TABLE user_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_address INET,
        user_agent TEXT
      );
      
      CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
      CREATE INDEX idx_user_sessions_token ON user_sessions(token);
      CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
    `,
    down: 'DROP TABLE user_sessions;',
  },
  {
    version: '003',
    name: 'create_categories_table',
    up: `
      CREATE TABLE categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        name_ar VARCHAR(255),
        slug VARCHAR(255) UNIQUE NOT NULL,
        description TEXT,
        description_ar TEXT,
        icon VARCHAR(50),
        parent_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        product_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_categories_slug ON categories(slug);
      CREATE INDEX idx_categories_parent_id ON categories(parent_id);
    `,
    down: 'DROP TABLE categories;',
  },
  {
    version: '004',
    name: 'create_stores_table',
    up: `
      CREATE TABLE stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        name_ar VARCHAR(255),
        slug VARCHAR(255) UNIQUE NOT NULL,
        logo TEXT,
        website TEXT NOT NULL,
        api_endpoint TEXT,
        affiliate_program VARCHAR(255),
        commission_rate DECIMAL(5, 2) DEFAULT 0,
        supported_regions TEXT[],
        supported_currencies TEXT[],
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_stores_slug ON stores(slug);
      CREATE INDEX idx_stores_is_active ON stores(is_active);
    `,
    down: 'DROP TABLE stores;',
  },
  {
    version: '005',
    name: 'create_products_table',
    up: `
      CREATE TABLE products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        title_ar VARCHAR(500),
        description TEXT,
        description_ar TEXT,
        image_url TEXT NOT NULL,
        category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        external_product_id VARCHAR(255) NOT NULL,
        external_url TEXT NOT NULL,
        price DECIMAL(10, 2) NOT NULL,
        original_price DECIMAL(10, 2),
        currency VARCHAR(3) DEFAULT 'USD',
        rating DECIMAL(3, 2),
        review_count INTEGER DEFAULT 0,
        in_stock BOOLEAN DEFAULT TRUE,
        specifications JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_price_check TIMESTAMP,
        UNIQUE(external_product_id, store_id)
      );
      
      CREATE INDEX idx_products_category_id ON products(category_id);
      CREATE INDEX idx_products_store_id ON products(store_id);
      CREATE INDEX idx_products_price ON products(price);
      CREATE INDEX idx_products_in_stock ON products(in_stock);
      CREATE INDEX idx_products_created_at ON products(created_at);
    `,
    down: 'DROP TABLE products;',
  },
  {
    version: '006',
    name: 'create_product_prices_table',
    up: `
      CREATE TABLE product_prices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_product_prices_product_id ON product_prices(product_id);
      CREATE INDEX idx_product_prices_recorded_at ON product_prices(recorded_at);
    `,
    down: 'DROP TABLE product_prices;',
  },
  {
    version: '007',
    name: 'create_deals_table',
    up: `
      CREATE TABLE deals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(500) NOT NULL,
        title_ar VARCHAR(500),
        description TEXT,
        description_ar TEXT,
        image_url TEXT,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        discount DECIMAL(5, 2) NOT NULL,
        discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
        price DECIMAL(10, 2) NOT NULL,
        original_price DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(3) DEFAULT 'USD',
        product_url TEXT NOT NULL,
        coupon_code VARCHAR(50),
        terms TEXT,
        starts_at TIMESTAMP NOT NULL,
        ends_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        is_featured BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_deals_category_id ON deals(category_id);
      CREATE INDEX idx_deals_store_id ON deals(store_id);
      CREATE INDEX idx_deals_is_active ON deals(is_active);
      CREATE INDEX idx_deals_is_featured ON deals(is_featured);
      CREATE INDEX idx_deals_ends_at ON deals(ends_at);
    `,
    down: 'DROP TABLE deals;',
  },
  {
    version: '008',
    name: 'create_coupons_table',
    up: `
      CREATE TABLE coupons (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        title VARCHAR(500) NOT NULL,
        title_ar VARCHAR(500),
        description TEXT,
        description_ar TEXT,
        store_id UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
        category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
        discount DECIMAL(10, 2) NOT NULL,
        discount_type VARCHAR(10) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
        min_purchase DECIMAL(10, 2),
        max_discount DECIMAL(10, 2),
        currency VARCHAR(3) DEFAULT 'USD',
        terms TEXT,
        starts_at TIMESTAMP NOT NULL,
        ends_at TIMESTAMP NOT NULL,
        usage_count INTEGER DEFAULT 0,
        max_usage INTEGER,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_coupons_store_id ON coupons(store_id);
      CREATE INDEX idx_coupons_category_id ON coupons(category_id);
      CREATE INDEX idx_coupons_code ON coupons(code);
      CREATE INDEX idx_coupons_is_active ON coupons(is_active);
      CREATE INDEX idx_coupons_ends_at ON coupons(ends_at);
    `,
    down: 'DROP TABLE coupons;',
  },
  {
    version: '009',
    name: 'create_wishlist_table',
    up: `
      CREATE TABLE wishlist_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        price_alert DECIMAL(10, 2),
        added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, product_id)
      );
      
      CREATE INDEX idx_wishlist_items_user_id ON wishlist_items(user_id);
      CREATE INDEX idx_wishlist_items_product_id ON wishlist_items(product_id);
    `,
    down: 'DROP TABLE wishlist_items;',
  },
  {
    version: '010',
    name: 'create_notifications_table',
    up: `
      CREATE TABLE notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL CHECK (type IN ('price_drop', 'coupon', 'deal', 'system', 'review', 'alert')),
        title VARCHAR(500) NOT NULL,
        title_ar VARCHAR(500),
        message TEXT NOT NULL,
        message_ar TEXT,
        data JSONB,
        read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP
      );
      
      CREATE INDEX idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX idx_notifications_read ON notifications(read);
      CREATE INDEX idx_notifications_type ON notifications(type);
      CREATE INDEX idx_notifications_created_at ON notifications(created_at);
    `,
    down: 'DROP TABLE notifications;',
  },
  {
    version: '011',
    name: 'create_affiliate_tables',
    up: `
      CREATE TABLE affiliate_links (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        marketplace VARCHAR(50) NOT NULL,
        original_url TEXT NOT NULL,
        affiliate_url TEXT NOT NULL,
        tracking_id VARCHAR(255) UNIQUE NOT NULL,
        commission_rate DECIMAL(5, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP
      );
      
      CREATE INDEX idx_affiliate_links_user_id ON affiliate_links(user_id);
      CREATE INDEX idx_affiliate_links_tracking_id ON affiliate_links(tracking_id);
      
      CREATE TABLE affiliate_clicks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        affiliate_link_id UUID NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        marketplace VARCHAR(50) NOT NULL,
        ip_address INET,
        user_agent TEXT,
        referrer TEXT,
        clicked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        converted BOOLEAN DEFAULT FALSE,
        conversion_value DECIMAL(10, 2),
        commission_earned DECIMAL(10, 2),
        converted_at TIMESTAMP
      );
      
      CREATE INDEX idx_affiliate_clicks_affiliate_link_id ON affiliate_clicks(affiliate_link_id);
      CREATE INDEX idx_affiliate_clicks_user_id ON affiliate_clicks(user_id);
      CREATE INDEX idx_affiliate_clicks_converted ON affiliate_clicks(converted);
      
      CREATE TABLE affiliate_commissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        affiliate_link_id UUID NOT NULL REFERENCES affiliate_links(id) ON DELETE CASCADE,
        click_id UUID NOT NULL REFERENCES affiliate_clicks(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        marketplace VARCHAR(50) NOT NULL,
        commission_rate DECIMAL(5, 2) NOT NULL,
        sale_amount DECIMAL(10, 2) NOT NULL,
        commission_amount DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_at TIMESTAMP,
        paid_at TIMESTAMP
      );
      
      CREATE INDEX idx_affiliate_commissions_user_id ON affiliate_commissions(user_id);
      CREATE INDEX idx_affiliate_commissions_status ON affiliate_commissions(status);
    `,
    down: `
      DROP TABLE affiliate_commissions;
      DROP TABLE affiliate_clicks;
      DROP TABLE affiliate_links;
    `,
  },
];

// Function to get migration SQL
export function getMigrationSQL(direction: 'up' | 'down', version?: string): string[] {
  if (version) {
    const migration = migrations.find(m => m.version === version);
    return migration ? [migration[direction]] : [];
  }
  return migrations.map(m => m[direction]);
}
