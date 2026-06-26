// Affiliate System
// This file handles affiliate link generation, tracking, and commission management

export interface AffiliateLink {
  id: string;
  userId: string;
  productId: string;
  marketplace: string;
  originalUrl: string;
  affiliateUrl: string;
  trackingId: string;
  commissionRate: number;
  createdAt: Date;
  expiresAt?: Date;
}

export interface AffiliateClick {
  id: string;
  affiliateLinkId: string;
  userId: string;
  productId: string;
  marketplace: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  clickedAt: Date;
  converted: boolean;
  conversionValue?: number;
  commissionEarned?: number;
  convertedAt?: Date;
}

export interface AffiliateCommission {
  id: string;
  userId: string;
  affiliateLinkId: string;
  clickId: string;
  productId: string;
  marketplace: string;
  commissionRate: number;
  saleAmount: number;
  commissionAmount: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
  approvedAt?: Date;
  paidAt?: Date;
}

export interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  totalCommission: number;
  conversionRate: number;
  averageCommission: number;
  pendingCommission: number;
  paidCommission: number;
}

class AffiliateSystem {
  private trackingDomain: string;
  private commissionRates: Record<string, number>;

  constructor(trackingDomain: string = 'zorino.org') {
    this.trackingDomain = trackingDomain;
    this.commissionRates = {
      amazon: 4,
      alibaba: 3,
      aliexpress: 5,
      noon: 6,
      temu: 7,
      ebay: 4,
      walmart: 3,
      bestbuy: 4,
    };
  }

  /**
   * Generate an affiliate link for a product
   */
  generateAffiliateLink(
    userId: string,
    productId: string,
    marketplace: string,
    originalUrl: string
  ): AffiliateLink {
    const trackingId = this.generateTrackingId(userId, productId);
    const affiliateUrl = this.buildAffiliateUrl(originalUrl, trackingId, marketplace);
    const commissionRate = this.commissionRates[marketplace] || 0;

    return {
      id: this.generateLinkId(),
      userId,
      productId,
      marketplace,
      originalUrl,
      affiliateUrl,
      trackingId,
      commissionRate,
      createdAt: new Date(),
    };
  }

  /**
   * Generate a unique tracking ID
   */
  private generateTrackingId(userId: string, productId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${userId.substring(0, 8)}-${productId.substring(0, 8)}-${timestamp}-${random}`;
  }

  /**
   * Generate a unique link ID
   */
  private generateLinkId(): string {
    return `link_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Build the affiliate URL with tracking parameters
   */
  private buildAffiliateUrl(originalUrl: string, trackingId: string, marketplace: string): string {
    const url = new URL(originalUrl);
    
    // Add tracking parameters
    url.searchParams.set('tag', trackingId);
    url.searchParams.set('ref', this.trackingDomain);
    
    // Marketplace-specific parameters
    switch (marketplace) {
      case 'amazon':
        url.searchParams.set('tag', trackingId);
        break;
      case 'aliexpress':
        url.searchParams.set('aff_platform', 'custom');
        url.searchParams.set('aff_trace_key', trackingId);
        break;
      case 'alibaba':
        url.searchParams.set('trace', trackingId);
        break;
      case 'noon':
        url.searchParams.set('ref', trackingId);
        break;
      case 'temu':
        url.searchParams.set('ref', trackingId);
        break;
      default:
        url.searchParams.set('ref', trackingId);
    }

    return url.toString();
  }

  /**
   * Track a click on an affiliate link
   */
  async trackClick(
    affiliateLinkId: string,
    userId: string,
    productId: string,
    marketplace: string,
    metadata?: {
      ipAddress?: string;
      userAgent?: string;
      referrer?: string;
    }
  ): Promise<AffiliateClick> {
    const click: AffiliateClick = {
      id: `click_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      affiliateLinkId,
      userId,
      productId,
      marketplace,
      ipAddress: metadata?.ipAddress,
      userAgent: metadata?.userAgent,
      referrer: metadata?.referrer,
      clickedAt: new Date(),
      converted: false,
    };

    // In production, save to database
    await this.saveClick(click);

    return click;
  }

  /**
   * Record a conversion (purchase) from an affiliate click
   */
  async recordConversion(
    clickId: string,
    saleAmount: number,
    marketplace: string
  ): Promise<AffiliateCommission> {
    const commissionRate = this.commissionRates[marketplace] || 0;
    const commissionAmount = saleAmount * (commissionRate / 100);

    const commission: AffiliateCommission = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: '', // Will be filled from click data
      affiliateLinkId: '', // Will be filled from click data
      clickId,
      productId: '',
      marketplace,
      commissionRate,
      saleAmount,
      commissionAmount,
      status: 'pending',
      createdAt: new Date(),
    };

    // In production, save to database and update click
    await this.saveCommission(commission);
    await this.updateClickConversion(clickId, true, saleAmount, commissionAmount);

    return commission;
  }

  /**
   * Get affiliate statistics for a user
   */
  async getAffiliateStats(userId: string): Promise<AffiliateStats> {
    // In production, fetch from database
    return {
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      totalCommission: 0,
      conversionRate: 0,
      averageCommission: 0,
      pendingCommission: 0,
      paidCommission: 0,
    };
  }

  /**
   * Get commission rate for a marketplace
   */
  getCommissionRate(marketplace: string): number {
    return this.commissionRates[marketplace] || 0;
  }

  /**
   * Set custom commission rate for a marketplace
   */
  setCommissionRate(marketplace: string, rate: number): void {
    this.commissionRates[marketplace] = rate;
  }

  /**
   * Validate if a URL is from a supported marketplace
   */
  isValidMarketplaceUrl(url: string): boolean {
    const validDomains = [
      'amazon.com',
      'amazon.co.uk',
      'amazon.de',
      'amazon.fr',
      'amazon.es',
      'amazon.it',
      'amazon.co.jp',
      'amazon.ca',
      'amazon.ae',
      'amazon.sa',
      'amazon.eg',
      'alibaba.com',
      'aliexpress.com',
      'noon.com',
      'temu.com',
      'ebay.com',
      'walmart.com',
      'bestbuy.com',
    ];

    try {
      const urlObj = new URL(url);
      return validDomains.some(domain => urlObj.hostname.includes(domain));
    } catch {
      return false;
    }
  }

  /**
   * Extract marketplace from URL
   */
  extractMarketplace(url: string): string | null {
    const marketplaceMap: Record<string, string> = {
      'amazon': 'amazon',
      'alibaba': 'alibaba',
      'aliexpress': 'aliexpress',
      'noon': 'noon',
      'temu': 'temu',
      'ebay': 'ebay',
      'walmart': 'walmart',
      'bestbuy': 'bestbuy',
    };

    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      for (const [key, domain] of Object.entries(marketplaceMap)) {
        if (hostname.includes(domain)) {
          return key;
        }
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Save click to database (placeholder)
   */
  private async saveClick(click: AffiliateClick): Promise<void> {
    // In production, save to database
    console.log('Saving click:', click);
  }

  /**
   * Save commission to database (placeholder)
   */
  private async saveCommission(commission: AffiliateCommission): Promise<void> {
    // In production, save to database
    console.log('Saving commission:', commission);
  }

  /**
   * Update click conversion status (placeholder)
   */
  private async updateClickConversion(
    clickId: string,
    converted: boolean,
    saleAmount?: number,
    commissionEarned?: number
  ): Promise<void> {
    // In production, update in database
    console.log('Updating click conversion:', clickId, converted, saleAmount, commissionEarned);
  }

  /**
   * Clean up expired affiliate links
   */
  async cleanupExpiredLinks(): Promise<number> {
    // In production, delete expired links from database
    return 0;
  }

  /**
   * Approve pending commissions
   */
  async approveCommissions(commissionIds: string[]): Promise<void> {
    // In production, update commission status in database
    console.log('Approving commissions:', commissionIds);
  }

  /**
   * Reject pending commissions
   */
  async rejectCommissions(commissionIds: string[]): Promise<void> {
    // In production, update commission status in database
    console.log('Rejecting commissions:', commissionIds);
  }

  /**
   * Mark commissions as paid
   */
  async markCommissionsAsPaid(commissionIds: string[]): Promise<void> {
    // In production, update commission status in database
    console.log('Marking commissions as paid:', commissionIds);
  }
}

// Export singleton instance
export const affiliateSystem = new AffiliateSystem();

// Export utility functions
export function generateAffiliateUrl(
  userId: string,
  productId: string,
  originalUrl: string
): string {
  const marketplace = affiliateSystem.extractMarketplace(originalUrl);
  if (!marketplace) {
    return originalUrl;
  }

  const link = affiliateSystem.generateAffiliateLink(
    userId,
    productId,
    marketplace,
    originalUrl
  );

  return link.affiliateUrl;
}

export function getCommissionForMarketplace(marketplace: string): number {
  return affiliateSystem.getCommissionRate(marketplace);
}
