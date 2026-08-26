// Security Utilities
// This file provides security utilities for validation, XSS prevention, CSRF protection, etc.

// XSS Prevention
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers like onclick=
    .trim();
}

export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeObject<T extends Record<string, any>>(obj: T): T {
  const sanitized: any = {};
  
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeInput(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  
  return sanitized;
}

// Input Validation
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

export function validatePhoneNumber(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s-()]{10,}$/;
  return phoneRegex.test(phone);
}

// CSRF Protection
export function generateCSRFToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function validateCSRFToken(token: string, sessionToken: string): boolean {
  return token === sessionToken;
}

// Rate Limiting — Supabase-backed for serverless safety.
// Falls back to in-memory when Supabase is unavailable (local dev without DB).
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export class RateLimiter {
  private maxRequests: number;
  private windowMs: number;
  private fallbackRequests: Map<string, number[]>;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    this.fallbackRequests = new Map();
  }

  async isAllowed(identifier: string): Promise<boolean> {
    const supabase = createSupabaseServiceClient();
    if (!supabase) return this.isAllowedFallback(identifier);

    try {
      const windowStart = new Date(Date.now() - this.windowMs).toISOString();
      const { count } = await supabase
        .from("rate_limit_events" as any)
        .select("id", { count: "exact", head: true })
        .eq("identifier", identifier)
        .gte("created_at", windowStart);

      if ((count ?? 0) >= this.maxRequests) return false;

      await supabase.from("rate_limit_events" as any).insert({
        identifier,
        created_at: new Date().toISOString(),
      } as any);
      return true;
    } catch {
      return this.isAllowedFallback(identifier);
    }
  }

  private isAllowedFallback(identifier: string): boolean {
    const now = Date.now();
    const userRequests = this.fallbackRequests.get(identifier) || [];
    const validRequests = userRequests.filter((t) => now - t < this.windowMs);
    if (validRequests.length >= this.maxRequests) return false;
    validRequests.push(now);
    this.fallbackRequests.set(identifier, validRequests);
    return true;
  }
}

export const rateLimiter = new RateLimiter(100, 60000);
export const authRateLimiter = new RateLimiter(5, 60000);
export const apiRateLimiter = new RateLimiter(1000, 60000);

// Secure Headers
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:;",
  };
}

// Content Security Policy Builder
export class CSPBuilder {
  private directives: Record<string, string[]>;

  constructor() {
    this.directives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      'style-src': ["'self'", "'unsafe-inline'"],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'data:'],
      'connect-src': ["'self'"],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
    };
  }

  addDirective(directive: string, sources: string[]): this {
    this.directives[directive] = sources;
    return this;
  }

  addSource(directive: string, source: string): this {
    if (!this.directives[directive]) {
      this.directives[directive] = [];
    }
    this.directives[directive].push(source);
    return this;
  }

  build(): string {
    return Object.entries(this.directives)
      .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
      .join('; ');
  }
}

// Hash utility for passwords
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

// Token generation
export function generateSecureToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Session management
export interface SessionData {
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
}

export function createSession(userId: string, email: string, duration: number = 24 * 60 * 60 * 1000): SessionData {
  const now = Date.now();
  return {
    userId,
    email,
    createdAt: now,
    expiresAt: now + duration,
  };
}

export function isSessionValid(session: SessionData): boolean {
  return Date.now() < session.expiresAt;
}

// SQL Injection Prevention
export function escapeSqlInput(input: string): string {
  return input.replace(/'/g, "''");
}

// File upload validation
export function validateFileUpload(
  file: File,
  allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  maxSize: number = 5 * 1024 * 1024 // 5MB
): { isValid: boolean; error?: string } {
  if (!allowedTypes.includes(file.type)) {
    return { isValid: false, error: 'Invalid file type' };
  }

  if (file.size > maxSize) {
    return { isValid: false, error: 'File size exceeds maximum allowed size' };
  }

  return { isValid: true };
}

// Security audit logging
export class SecurityLogger {
  private logs: Array<{
    timestamp: number;
    event: string;
    details: any;
  }>;

  constructor() {
    this.logs = [];
  }

  log(event: string, details: any): void {
    this.logs.push({
      timestamp: Date.now(),
      event,
      details,
    });

    // In production, send to logging service
    console.log(`[Security] ${event}:`, details);
  }

  getLogs(): Array<{ timestamp: number; event: string; details: any }> {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }
}

export const securityLogger = new SecurityLogger();
