// Performance Optimization Utilities
// This file provides utilities for lazy loading, caching, and performance optimization

import { useState, useEffect, useRef } from 'react';

// Simple in-memory cache implementation
class Cache {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }>;
  private defaultTTL: number;

  constructor(defaultTTL: number = 5 * 60 * 1000) {
    // Default TTL: 5 minutes
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
  }

  set(key: string, data: any, ttl?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;

    const now = Date.now();
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  // Clean up expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Global cache instances
export const apiCache = new Cache(5 * 60 * 1000); // 5 minutes for API responses
export const staticCache = new Cache(60 * 60 * 1000); // 1 hour for static data
export const imageCache = new Cache(24 * 60 * 60 * 1000); // 24 hours for images

// Lazy load images hook
export function useLazyImage(src: string, threshold: number = 100) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      { threshold: threshold / 100 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  useEffect(() => {
    if (isInView && src) {
      const img = new Image();
      img.onload = () => setIsLoaded(true);
      img.src = src;
    }
  }, [isInView, src]);

  return { imgRef, isLoaded, isInView };
}

// Debounce function
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Throttle function
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Memoize function
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map();

  return ((...args: Parameters<T>) => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = func(...args);
    cache.set(key, result);
    return result;
  }) as T;
}

// Lazy load component hook
export function useLazyLoad(threshold: number = 0.1) {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsLoaded(true);
            observer.disconnect();
          }
        });
      },
      { threshold }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [threshold]);

  return { isLoaded, containerRef };
}

// Prefetch resources
export function prefetchResource(url: string, type: 'image' | 'script' | 'style' | 'font'): void {
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;

  if (type === 'image') {
    link.as = 'image';
  } else if (type === 'script') {
    link.as = 'script';
  } else if (type === 'style') {
    link.as = 'style';
  } else if (type === 'font') {
    link.as = 'font';
    link.crossOrigin = 'anonymous';
  }

  document.head.appendChild(link);
}

// Preload critical resources
export function preloadResource(url: string, type: 'image' | 'script' | 'style' | 'font'): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;

  if (type === 'image') {
    link.as = 'image';
  } else if (type === 'script') {
    link.as = 'script';
  } else if (type === 'style') {
    link.as = 'style';
  } else if (type === 'font') {
    link.as = 'font';
    link.crossOrigin = 'anonymous';
  }

  document.head.appendChild(link);
}

// Fetch with caching
export async function fetchWithCache<T>(
  url: string,
  options?: RequestInit,
  cacheKey?: string,
  ttl?: number
): Promise<T> {
  const key = cacheKey || url;
  const cached = apiCache.get(key);

  if (cached) {
    return cached as T;
  }

  const response = await fetch(url, options);
  const data = await response.json();

  apiCache.set(key, data, ttl);

  return data;
}

// Batch requests
export async function batchRequests<T>(
  requests: Array<{ url: string; options?: RequestInit }>,
  concurrency: number = 5
): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];

  for (const request of requests) {
    const promise = (async () => {
      const response = await fetch(request.url, request.options);
      const data = await response.json();
      results.push(data);
    })();

    executing.push(promise);

    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

// Virtual scroll hook for large lists
export function useVirtualScroll<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number
) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight) + 1,
    items.length
  );

  const visibleItems = items.slice(visibleStart, visibleEnd);
  const offsetY = visibleStart * itemHeight;

  return {
    visibleItems,
    offsetY,
    onScroll: (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
    },
  };
}

// Image optimization utility
export function getOptimizedImageUrl(
  url: string,
  width?: number,
  height?: number,
  quality: number = 80
): string {
  // In production, this would use an image optimization service
  // For now, return the original URL
  return url;
}

// Performance monitoring
export class PerformanceMonitor {
  private marks: Map<string, number>;

  constructor() {
    this.marks = new Map();
  }

  mark(name: string): void {
    this.marks.set(name, performance.now());
  }

  measure(name: string, startMark: string, endMark?: string): number {
    const start = this.marks.get(startMark);
    const end = endMark ? this.marks.get(endMark) : performance.now();

    if (start === undefined || end === undefined) {
      return 0;
    }

    const duration = end - start;
    console.log(`[Performance] ${name}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  clear(): void {
    this.marks.clear();
  }
}

export const performanceMonitor = new PerformanceMonitor();
