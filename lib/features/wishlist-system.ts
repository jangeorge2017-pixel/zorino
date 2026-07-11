// Wishlist/Favorites System
// This file implements the wishlist functionality for users to save products

import { useState } from 'react';
import { apiCache } from '../performance/optimization';

export interface WishlistItem {
  id: string;
  userId: string;
  productId: string;
  priceAlert?: number;
  addedAt: Date;
}

export interface WishlistStats {
  totalItems: number;
  itemsWithPriceAlerts: number;
  priceDropCount: number;
}

class WishlistSystem {
  private storageKey = 'zorino_wishlist';
  private priceAlertStorageKey = 'zorino_price_alerts';

  /**
   * Get all wishlist items for a user
   */
  async getWishlistItems(userId: string): Promise<WishlistItem[]> {
    const cacheKey = `wishlist_${userId}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    // In production, fetch from database
    const items = this.getLocalWishlist(userId);
    apiCache.set(cacheKey, items, 5 * 60 * 1000); // 5 minutes
    return items;
  }

  /**
   * Add a product to wishlist
   */
  async addToWishlist(
    userId: string,
    productId: string,
    priceAlert?: number
  ): Promise<WishlistItem> {
    const items = await this.getWishlistItems(userId);
    
    // Check if already in wishlist
    const existing = items.find(item => item.productId === productId);
    if (existing) {
      // Update price alert if provided
      if (priceAlert !== undefined) {
        existing.priceAlert = priceAlert;
        this.saveLocalWishlist(userId, items);
      }
      return existing;
    }

    const newItem: WishlistItem = {
      id: `wishlist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      productId,
      priceAlert,
      addedAt: new Date(),
    };

    items.push(newItem);
    this.saveLocalWishlist(userId, items);
    
    // Clear cache
    apiCache.delete(`wishlist_${userId}`);

    return newItem;
  }

  /**
   * Remove a product from wishlist
   */
  async removeFromWishlist(userId: string, productId: string): Promise<boolean> {
    const items = await this.getWishlistItems(userId);
    const filtered = items.filter(item => item.productId !== productId);
    
    if (filtered.length === items.length) {
      return false; // Item not found
    }

    this.saveLocalWishlist(userId, filtered);
    apiCache.delete(`wishlist_${userId}`);
    return true;
  }

  /**
   * Check if a product is in wishlist
   */
  async isInWishlist(userId: string, productId: string): Promise<boolean> {
    const items = await this.getWishlistItems(userId);
    return items.some(item => item.productId === productId);
  }

  /**
   * Set price alert for a wishlist item
   */
  async setPriceAlert(
    userId: string,
    productId: string,
    targetPrice: number
  ): Promise<boolean> {
    const items = await this.getWishlistItems(userId);
    const item = items.find(i => i.productId === productId);
    
    if (!item) return false;

    item.priceAlert = targetPrice;
    this.saveLocalWishlist(userId, items);
    apiCache.delete(`wishlist_${userId}`);
    return true;
  }

  /**
   * Remove price alert
   */
  async removePriceAlert(userId: string, productId: string): Promise<boolean> {
    const items = await this.getWishlistItems(userId);
    const item = items.find(i => i.productId === productId);
    
    if (!item) return false;

    delete item.priceAlert;
    this.saveLocalWishlist(userId, items);
    apiCache.delete(`wishlist_${userId}`);
    return true;
  }

  /**
   * Get wishlist statistics
   */
  async getWishlistStats(userId: string): Promise<WishlistStats> {
    const items = await this.getWishlistItems(userId);
    
    return {
      totalItems: items.length,
      itemsWithPriceAlerts: items.filter(item => item.priceAlert !== undefined).length,
      priceDropCount: 0, // In production, calculate based on current prices
    };
  }

  /**
   * Clear entire wishlist
   */
  async clearWishlist(userId: string): Promise<void> {
    this.saveLocalWishlist(userId, []);
    apiCache.delete(`wishlist_${userId}`);
  }

  /**
   * Check for price drops and trigger alerts
   */
  async checkPriceAlerts(userId: string): Promise<WishlistItem[]> {
    const items = await this.getWishlistItems(userId);
    // Price-alert evaluation requires a live product price service.
    // Until that service is wired, do not fabricate alerts.
    return [];
  }

  // Local storage helpers (for client-side demo)
  private getLocalWishlist(userId: string): WishlistItem[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(`${this.storageKey}_${userId}`);
    return data ? JSON.parse(data) : [];
  }

  private saveLocalWishlist(userId: string, items: WishlistItem[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${this.storageKey}_${userId}`, JSON.stringify(items));
  }
}

export const wishlistSystem = new WishlistSystem();

// React hook for wishlist
export function useWishlist(userId: string) {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadWishlist = async () => {
    setLoading(true);
    const data = await wishlistSystem.getWishlistItems(userId);
    setItems(data);
    setLoading(false);
  };

  const addToWishlist = async (productId: string, priceAlert?: number) => {
    await wishlistSystem.addToWishlist(userId, productId, priceAlert);
    await loadWishlist();
  };

  const removeFromWishlist = async (productId: string) => {
    await wishlistSystem.removeFromWishlist(userId, productId);
    await loadWishlist();
  };

  const checkIsInWishlist = async (productId: string) => {
    return await wishlistSystem.isInWishlist(userId, productId);
  };

  const setPriceAlert = async (productId: string, targetPrice: number) => {
    await wishlistSystem.setPriceAlert(userId, productId, targetPrice);
    await loadWishlist();
  };

  const removePriceAlert = async (productId: string) => {
    await wishlistSystem.removePriceAlert(userId, productId);
    await loadWishlist();
  };

  return {
    items,
    loading,
    loadWishlist,
    addToWishlist,
    removeFromWishlist,
    checkIsInWishlist,
    setPriceAlert,
    removePriceAlert,
  };
}
