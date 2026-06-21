// Search System with Filters
// This file implements the search functionality with advanced filtering

import { useState } from 'react';
import { apiCache } from '../performance/optimization';
import { debounce } from '../performance/optimization';

export interface SearchFilters {
  query: string;
  category?: string;
  store?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  inStock?: boolean;
  sortBy?: 'relevance' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: string;
  title: string;
  titleAr?: string;
  price: number;
  originalPrice?: number;
  currency: string;
  imageUrl: string;
  category: string;
  store: string;
  rating?: number;
  reviewCount?: number;
  inStock: boolean;
  relevanceScore: number;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: SearchFilters;
  facets: {
    categories: Record<string, number>;
    stores: Record<string, number>;
    priceRanges: Record<string, number>;
  };
}

class SearchSystem {
  private searchHistory: Map<string, Array<{ query: string; timestamp: number }>>;

  constructor() {
    this.searchHistory = new Map();
  }

  /**
   * Search products with filters
   */
  async search(filters: SearchFilters): Promise<SearchResponse> {
    const cacheKey = this.getCacheKey(filters);
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    // In production, this would query the database or search service
    const results = await this.performSearch(filters);
    
    apiCache.set(cacheKey, results, 5 * 60 * 1000); // 5 minutes cache
    return results;
  }

  /**
   * Get search suggestions
   */
  async getSuggestions(query: string, limit: number = 5): Promise<string[]> {
    if (!query || query.length < 2) return [];

    const cacheKey = `suggestions_${query}`;
    const cached = apiCache.get(cacheKey);
    if (cached) return cached;

    // In production, this would query a search service
    const suggestions = this.generateSuggestions(query, limit);
    
    apiCache.set(cacheKey, suggestions, 10 * 60 * 1000); // 10 minutes cache
    return suggestions;
  }

  /**
   * Save search to history
   */
  saveToHistory(userId: string, query: string): void {
    const history = this.searchHistory.get(userId) || [];
    history.unshift({ query, timestamp: Date.now() });
    
    // Keep only last 10 searches
    const trimmed = history.slice(0, 10);
    this.searchHistory.set(userId, trimmed);
  }

  /**
   * Get search history for a user
   */
  getHistory(userId: string): Array<{ query: string; timestamp: number }> {
    return this.searchHistory.get(userId) || [];
  }

  /**
   * Clear search history
   */
  clearHistory(userId: string): void {
    this.searchHistory.delete(userId);
  }

  /**
   * Get popular searches
   */
  async getPopularSearches(limit: number = 10): Promise<string[]> {
    // In production, this would query analytics data
    return [
      'iPhone 15',
      'MacBook Air',
      'Samsung TV',
      'Nike shoes',
      'PlayStation 5',
      'AirPods',
      'iPad Pro',
      'Sony headphones',
      'Gaming laptop',
      'Smart watch',
    ].slice(0, limit);
  }

  /**
   * Calculate relevance score for a product
   */
  calculateRelevanceScore(product: any, query: string): number {
    let score = 0;
    const queryLower = query.toLowerCase();

    // Title match
    if (product.title.toLowerCase().includes(queryLower)) {
      score += 50;
    }

    // Exact title match
    if (product.title.toLowerCase() === queryLower) {
      score += 30;
    }

    // Category match
    if (product.category.toLowerCase().includes(queryLower)) {
      score += 20;
    }

    // Store match
    if (product.store.toLowerCase().includes(queryLower)) {
      score += 15;
    }

    // Word match in title
    const words = queryLower.split(' ');
    const titleWords = product.title.toLowerCase().split(' ');
    words.forEach(word => {
      if (titleWords.includes(word)) {
        score += 10;
      }
    });

    return Math.min(score, 100);
  }

  /**
   * Sort results based on criteria
   */
  sortResults(results: SearchResult[], sortBy: string): SearchResult[] {
    const sorted = [...results];

    switch (sortBy) {
      case 'price_asc':
        return sorted.sort((a, b) => a.price - b.price);
      case 'price_desc':
        return sorted.sort((a, b) => b.price - a.price);
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      case 'newest':
        return sorted.sort((a, b) => b.id.localeCompare(a.id));
      case 'relevance':
      default:
        return sorted.sort((a, b) => b.relevanceScore - a.relevanceScore);
    }
  }

  /**
   * Filter results
   */
  filterResults(results: SearchResult[], filters: SearchFilters): SearchResult[] {
    let filtered = [...results];

    if (filters.category) {
      filtered = filtered.filter(r => r.category === filters.category);
    }

    if (filters.store) {
      filtered = filtered.filter(r => r.store === filters.store);
    }

    if (filters.minPrice !== undefined) {
      filtered = filtered.filter(r => r.price >= filters.minPrice!);
    }

    if (filters.maxPrice !== undefined) {
      filtered = filtered.filter(r => r.price <= filters.maxPrice!);
    }

    if (filters.rating !== undefined) {
      filtered = filtered.filter(r => (r.rating || 0) >= filters.rating!);
    }

    if (filters.inStock !== undefined) {
      filtered = filtered.filter(r => r.inStock === filters.inStock);
    }

    return filtered;
  }

  /**
   * Generate facets for filtering
   */
  generateFacets(results: SearchResult[]): SearchResponse['facets'] {
    const categories: Record<string, number> = {};
    const stores: Record<string, number> = {};
    const priceRanges: Record<string, number> = {
      '0-50': 0,
      '50-100': 0,
      '100-250': 0,
      '250-500': 0,
      '500+': 0,
    };

    results.forEach(result => {
      categories[result.category] = (categories[result.category] || 0) + 1;
      stores[result.store] = (stores[result.store] || 0) + 1;

      if (result.price < 50) priceRanges['0-50']++;
      else if (result.price < 100) priceRanges['50-100']++;
      else if (result.price < 250) priceRanges['100-250']++;
      else if (result.price < 500) priceRanges['250-500']++;
      else priceRanges['500+']++;
    });

    return { categories, stores, priceRanges };
  }

  private getCacheKey(filters: SearchFilters): string {
    return `search_${JSON.stringify(filters)}`;
  }

  private async performSearch(filters: SearchFilters): Promise<SearchResponse> {
    // In production, this would query the database
    // For now, return mock data
    const mockResults: SearchResult[] = [];
    const total = 100; // Mock total

    return {
      results: mockResults,
      total,
      page: filters.page || 1,
      limit: filters.limit || 20,
      totalPages: Math.ceil(total / (filters.limit || 20)),
      filters,
      facets: {
        categories: { Electronics: 45, Fashion: 30, Home: 25 },
        stores: { Amazon: 40, AliExpress: 35, Noon: 25 },
        priceRanges: { '0-50': 20, '50-100': 30, '100-250': 25, '250-500': 15, '500+': 10 },
      },
    };
  }

  private generateSuggestions(query: string, limit: number): string[] {
    const suggestions = [
      `${query} deals`,
      `${query} coupons`,
      `${query} price`,
      `${query} discount`,
      `${query} offers`,
    ];

    return suggestions.slice(0, limit);
  }
}

export const searchSystem = new SearchSystem();

// Debounced search hook
export function useDebouncedSearch(delay: number = 300) {
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);

  const debouncedSearch = debounce(async (filters: SearchFilters) => {
    setIsSearching(true);
    const response = await searchSystem.search(filters);
    setResults(response.results);
    setIsSearching(false);
  }, delay);

  return {
    isSearching,
    results,
    search: debouncedSearch,
  };
}

// React hook for search
export function useSearch(userId?: string) {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [history, setHistory] = useState<Array<{ query: string; timestamp: number }>>([]);

  const search = async (filters: SearchFilters) => {
    setLoading(true);
    const result = await searchSystem.search(filters);
    setResponse(result);
    setLoading(false);

    if (userId && filters.query) {
      searchSystem.saveToHistory(userId, filters.query);
    }

    return result;
  };

  const loadSuggestions = async (query: string) => {
    const result = await searchSystem.getSuggestions(query);
    setSuggestions(result);
  };

  const loadHistory = () => {
    if (userId) {
      const hist = searchSystem.getHistory(userId);
      setHistory(hist);
    }
  };

  const clearHistory = () => {
    if (userId) {
      searchSystem.clearHistory(userId);
      setHistory([]);
    }
  };

  const loadPopularSearches = async () => {
    return await searchSystem.getPopularSearches();
  };

  return {
    loading,
    response,
    suggestions,
    history,
    search,
    loadSuggestions,
    loadHistory,
    clearHistory,
    loadPopularSearches,
  };
}
