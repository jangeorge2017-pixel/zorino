// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
  isVerified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProfile extends User {
  phone?: string;
  country?: string;
  preferences: {
    language: 'en' | 'ar';
    theme: 'dark' | 'light';
    currency: string;
  };
}

// Product Types
export interface Product {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  images: string[];
  category: Category;
  store: Store;
  price: number;
  originalPrice?: number;
  discount?: number;
  currency: string;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  affiliateUrl?: string;
  specifications: Record<string, string>;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductComparison {
  id: string;
  userId: string;
  products: Product[];
  createdAt: Date;
  updatedAt: Date;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  icon: string;
  image?: string;
  parentId?: string;
  order: number;
  isActive: boolean;
}

// Store Types
export interface Store {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  logo: string;
  website: string;
  rating: number;
  reviewCount: number;
  country: string;
  isActive: boolean;
  integrationType: 'amazon' | 'alibaba' | 'aliexpress' | 'noon' | 'temu' | 'custom';
  affiliateCommission?: number;
}

// Deal Types
export interface Deal {
  id: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  product: Product;
  discount: number;
  originalPrice: number;
  dealPrice: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  featured: boolean;
}

// Coupon Types
export interface Coupon {
  id: string;
  code: string;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  store: Store;
  discount: number;
  discountType: 'percentage' | 'fixed';
  minPurchase?: number;
  maxDiscount?: number;
  startDate: Date;
  endDate: Date;
  uses: number;
  maxUses?: number;
  isActive: boolean;
}

// Blog Types
export interface BlogPost {
  id: string;
  title: string;
  titleAr: string;
  slug: string;
  content: string;
  contentAr: string;
  excerpt: string;
  excerptAr: string;
  image: string;
  author: User;
  category: string;
  tags: string[];
  publishedAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

// Review Types
export interface Review {
  id: string;
  userId: string;
  user: User;
  productId: string;
  product: Product;
  rating: number;
  title: string;
  titleAr: string;
  content: string;
  contentAr: string;
  pros: string[];
  cons: string[];
  verified: boolean;
  helpful: number;
  createdAt: Date;
  updatedAt: Date;
}

// Wishlist Types
export interface Wishlist {
  id: string;
  userId: string;
  user: User;
  products: Product[];
  createdAt: Date;
  updatedAt: Date;
}

// Notification Types
export interface Notification {
  id: string;
  userId: string;
  type: 'price_drop' | 'deal' | 'coupon' | 'review' | 'system';
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  link?: string;
  read: boolean;
  createdAt: Date;
}

// Contact Types
export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved';
  createdAt: Date;
  updatedAt: Date;
}

// Search Types
export interface SearchFilters {
  query?: string;
  category?: string;
  store?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  sortBy?: 'relevance' | 'price_low' | 'price_high' | 'rating' | 'newest';
  inStock?: boolean;
}

export interface SearchResult {
  products: Product[];
  deals: Deal[];
  coupons: Coupon[];
  total: number;
  page: number;
  pageSize: number;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
