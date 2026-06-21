// Product Comparison System
// This file implements the product comparison functionality

import { useState } from 'react';
import { apiCache } from '../performance/optimization';

export interface ComparisonItem {
  id: string;
  userId: string;
  productId: string;
  addedAt: Date;
}

export interface ComparisonResult {
  products: any[];
  specifications: Record<string, any[]>;
  priceComparison: {
    lowestPrice: number;
    highestPrice: number;
    bestValue: string;
  };
  ratingComparison: {
    highestRated: string;
    averageRating: number;
  };
}

class ComparisonSystem {
  private storageKey = 'zorino_comparison';
  private maxItems = 4;

  /**
   * Get all comparison items for a user
   */
  async getComparisonItems(userId: string): Promise<ComparisonItem[]> {
    const cacheKey = `comparison_${userId}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    const items = this.getLocalComparison(userId);
    apiCache.set(cacheKey, items, 5 * 60 * 1000);
    return items;
  }

  /**
   * Add a product to comparison
   */
  async addToComparison(userId: string, productId: string): Promise<ComparisonItem | null> {
    const items = await this.getComparisonItems(userId);
    
    // Check if already in comparison
    const existing = items.find(item => item.productId === productId);
    if (existing) return existing;

    // Check if max items reached
    if (items.length >= this.maxItems) {
      return null;
    }

    const newItem: ComparisonItem = {
      id: `comparison_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      productId,
      addedAt: new Date(),
    };

    items.push(newItem);
    this.saveLocalComparison(userId, items);
    apiCache.delete(`comparison_${userId}`);
    return newItem;
  }

  /**
   * Remove a product from comparison
   */
  async removeFromComparison(userId: string, productId: string): Promise<boolean> {
    const items = await this.getComparisonItems(userId);
    const filtered = items.filter(item => item.productId !== productId);
    
    if (filtered.length === items.length) return false;

    this.saveLocalComparison(userId, filtered);
    apiCache.delete(`comparison_${userId}`);
    return true;
  }

  /**
   * Check if a product is in comparison
   */
  async isInComparison(userId: string, productId: string): Promise<boolean> {
    const items = await this.getComparisonItems(userId);
    return items.some(item => item.productId === productId);
  }

  /**
   * Clear entire comparison
   */
  async clearComparison(userId: string): Promise<void> {
    this.saveLocalComparison(userId, []);
    apiCache.delete(`comparison_${userId}`);
  }

  /**
   * Generate comparison result
   */
  async generateComparison(userId: string, products: any[]): Promise<ComparisonResult> {
    if (products.length === 0) {
      return {
        products: [],
        specifications: {},
        priceComparison: { lowestPrice: 0, highestPrice: 0, bestValue: '' },
        ratingComparison: { highestRated: '', averageRating: 0 },
      };
    }

    // Extract specifications
    const specifications: Record<string, any[]> = {};
    const specKeys = new Set<string>();

    products.forEach(product => {
      if (product.specifications) {
        Object.keys(product.specifications).forEach(key => specKeys.add(key));
      }
    });

    specKeys.forEach(key => {
      specifications[key] = products.map(p => ({
        productId: p.id,
        value: p.specifications?.[key] || 'N/A',
      }));
    });

    // Price comparison
    const prices = products.map(p => p.price);
    const lowestPrice = Math.min(...prices);
    const highestPrice = Math.max(...prices);
    const bestValue = products.find(p => p.price === lowestPrice)?.id || '';

    // Rating comparison
    const ratings = products.map(p => p.rating || 0);
    const highestRated = products.find(p => p.rating === Math.max(...ratings))?.id || '';
    const averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;

    return {
      products,
      specifications,
      priceComparison: {
        lowestPrice,
        highestPrice,
        bestValue,
      },
      ratingComparison: {
        highestRated,
        averageRating,
      },
    };
  }

  /**
   * Find differences between products
   */
  findDifferences(comparison: ComparisonResult): Record<string, string[]> {
    const differences: Record<string, string[]> = {};

    Object.entries(comparison.specifications).forEach(([spec, values]) => {
      const uniqueValues = new Set(values.map(v => v.value));
      if (uniqueValues.size > 1) {
        differences[spec] = Array.from(uniqueValues);
      }
    });

    return differences;
  }

  /**
   * Find similarities between products
   */
  findSimilarities(comparison: ComparisonResult): Record<string, string> {
    const similarities: Record<string, string> = {};

    Object.entries(comparison.specifications).forEach(([spec, values]) => {
      const uniqueValues = new Set(values.map(v => v.value));
      if (uniqueValues.size === 1) {
        similarities[spec] = Array.from(uniqueValues)[0];
      }
    });

    return similarities;
  }

  /**
   * Get comparison score for a product
   */
  calculateProductScore(product: any, comparison: ComparisonResult): number {
    let score = 0;
    const maxScore = 100;

    // Price score (lower is better)
    const priceScore = this.calculatePriceScore(product, comparison.priceComparison);
    score += priceScore * 30; // 30% weight

    // Rating score (higher is better)
    const ratingScore = this.calculateRatingScore(product, comparison.ratingComparison);
    score += ratingScore * 25; // 25% weight

    // Availability score
    if (product.inStock) score += 20;

    // Review count score
    const reviewScore = Math.min(product.reviewCount / 1000, 1) * 25;
    score += reviewScore;

    return Math.min(score, maxScore);
  }

  private calculatePriceScore(product: any, priceComparison: any): number {
    const range = priceComparison.highestPrice - priceComparison.lowestPrice;
    if (range === 0) return 1;
    return 1 - (product.price - priceComparison.lowestPrice) / range;
  }

  private calculateRatingScore(product: any, ratingComparison: any): number {
    if (!product.rating) return 0;
    return product.rating / 5; // Assuming 5-star rating system
  }

  // Local storage helpers
  private getLocalComparison(userId: string): ComparisonItem[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(`${this.storageKey}_${userId}`);
    return data ? JSON.parse(data) : [];
  }

  private saveLocalComparison(userId: string, items: ComparisonItem[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${this.storageKey}_${userId}`, JSON.stringify(items));
  }
}

export const comparisonSystem = new ComparisonSystem();

// React hook for comparison
export function useComparison(userId: string) {
  const [items, setItems] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(false);

  const loadComparison = async () => {
    setLoading(true);
    const data = await comparisonSystem.getComparisonItems(userId);
    setItems(data);
    setLoading(false);
  };

  const addToComparison = async (productId: string) => {
    const result = await comparisonSystem.addToComparison(userId, productId);
    if (result) {
      await loadComparison();
    }
    return result;
  };

  const removeFromComparison = async (productId: string) => {
    await comparisonSystem.removeFromComparison(userId, productId);
    await loadComparison();
  };

  const checkIsInComparison = async (productId: string) => {
    return await comparisonSystem.isInComparison(userId, productId);
  };

  const clearComparison = async () => {
    await comparisonSystem.clearComparison(userId);
    await loadComparison();
  };

  const canAddMore = () => {
    return items.length < comparisonSystem['maxItems'];
  };

  return {
    items,
    loading,
    loadComparison,
    addToComparison,
    removeFromComparison,
    checkIsInComparison,
    clearComparison,
    canAddMore,
    maxItems: comparisonSystem['maxItems'],
  };
}
