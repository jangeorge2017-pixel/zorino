// Newsletter System
// This file implements the newsletter subscription and email campaign system

import { useState } from 'react';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  name?: string;
  locale: 'en' | 'ar';
  isActive: boolean;
  subscribedAt: Date;
  unsubscribedAt?: Date;
}

export interface NewsletterCampaign {
  id: string;
  subject: string;
  subjectAr?: string;
  content: string;
  contentAr?: string;
  scheduledFor?: Date;
  sentAt?: Date;
  status: 'draft' | 'scheduled' | 'sent';
  sentCount: number;
  openedCount: number;
  clickedCount: number;
}

class NewsletterSystem {
  private storageKey = 'zorino_newsletter_subscribers';

  /**
   * Subscribe to newsletter
   */
  async subscribe(email: string, name?: string, locale: 'en' | 'ar' = 'en'): Promise<NewsletterSubscriber> {
    const subscriber: NewsletterSubscriber = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      email,
      name,
      locale,
      isActive: true,
      subscribedAt: new Date(),
    };

    // In production, save to database
    await this.saveSubscriber(subscriber);

    // Send confirmation email
    await this.sendConfirmationEmail(subscriber);

    return subscriber;
  }

  /**
   * Unsubscribe from newsletter
   */
  async unsubscribe(email: string): Promise<boolean> {
    const subscribers = this.getLocalSubscribers();
    const subscriber = subscribers.find(s => s.email === email);
    
    if (!subscriber) return false;

    subscriber.isActive = false;
    subscriber.unsubscribedAt = new Date();
    this.saveLocalSubscribers(subscribers);

    // Send goodbye email
    await this.sendGoodbyeEmail(subscriber);

    return true;
  }

  /**
   * Check if email is subscribed
   */
  async isSubscribed(email: string): Promise<boolean> {
    const subscribers = this.getLocalSubscribers();
    const subscriber = subscribers.find(s => s.email === email);
    return subscriber ? subscriber.isActive : false;
  }

  /**
   * Get all active subscribers
   */
  async getSubscribers(locale?: 'en' | 'ar'): Promise<NewsletterSubscriber[]> {
    const subscribers = this.getLocalSubscribers();
    const active = subscribers.filter(s => s.isActive);
    
    if (locale) {
      return active.filter(s => s.locale === locale);
    }

    return active;
  }

  /**
   * Create newsletter campaign
   */
  async createCampaign(campaign: Omit<NewsletterCampaign, 'id' | 'status' | 'sentCount' | 'openedCount' | 'clickedCount'>): Promise<NewsletterCampaign> {
    const newCampaign: NewsletterCampaign = {
      ...campaign,
      id: `camp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      status: campaign.scheduledFor ? 'scheduled' : 'draft',
      sentCount: 0,
      openedCount: 0,
      clickedCount: 0,
    };

    // In production, save to database
    console.log('Created newsletter campaign:', newCampaign);

    return newCampaign;
  }

  /**
   * Send newsletter campaign
   */
  async sendCampaign(campaignId: string): Promise<void> {
    const subscribers = await this.getSubscribers();
    
    for (const subscriber of subscribers) {
      await this.sendNewsletterEmail(subscriber, campaignId);
    }

    console.log(`Sent newsletter to ${subscribers.length} subscribers`);
  }

  /**
   * Get subscriber statistics
   */
  async getStats(): Promise<{
    totalSubscribers: number;
    activeSubscribers: number;
    newSubscribersThisWeek: number;
    newSubscribersThisMonth: number;
  }> {
    const subscribers = this.getLocalSubscribers();
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return {
      totalSubscribers: subscribers.length,
      activeSubscribers: subscribers.filter(s => s.isActive).length,
      newSubscribersThisWeek: subscribers.filter(s => s.subscribedAt >= weekAgo).length,
      newSubscribersThisMonth: subscribers.filter(s => s.subscribedAt >= monthAgo).length,
    };
  }

  /**
   * Send confirmation email
   */
  private async sendConfirmationEmail(subscriber: NewsletterSubscriber): Promise<void> {
    const emailContent = {
      to: subscriber.email,
      subject: 'Welcome to ZORINO Newsletter!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ZORINO Newsletter</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8b5cf6, #3b82f6); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; padding: 15px 30px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Welcome to ZORINO!</h1>
              <p>Your journey to amazing deals starts here</p>
            </div>
            <div class="content">
              <p>Hi${subscriber.name ? ` ${subscriber.name}` : ''},</p>
              <p>Thank you for subscribing to the ZORINO newsletter! You're now part of our community of savvy shoppers who never miss a deal.</p>
              <p>What to expect:</p>
              <ul>
                <li>Exclusive deals and discounts</li>
                <li>Price drop alerts on your wishlist items</li>
                <li>Shopping tips and guides</li>
                <li>Early access to new features</li>
              </ul>
              <a href="https://zorino.com" class="button">Start Saving Now</a>
            </div>
            <div class="footer">
              <p>You received this email because you subscribed to ZORINO newsletter.</p>
              <p>To unsubscribe, click <a href="https://zorino.com/unsubscribe?email=${subscriber.email}">here</a>.</p>
              <p>&copy; ${new Date().getFullYear()} ZORINO. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log('Sending confirmation email:', emailContent);
  }

  /**
   * Send goodbye email
   */
  private async sendGoodbyeEmail(subscriber: NewsletterSubscriber): Promise<void> {
    const emailContent = {
      to: subscriber.email,
      subject: 'Goodbye from ZORINO',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Goodbye from ZORINO</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #8b5cf6, #3b82f6); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>We'll Miss You!</h1>
            </div>
            <div class="content">
              <p>Hi${subscriber.name ? ` ${subscriber.name}` : ''},</p>
              <p>We're sorry to see you go. You've been successfully unsubscribed from the ZORINO newsletter.</p>
              <p>If you ever want to re-subscribe, just visit our website and sign up again.</p>
              <p>We hope to see you again soon!</p>
              <a href="https://zorino.com">Return to ZORINO</a>
            </div>
            <div class="footer">
              <p>&copy; ${new Date().getFullYear()} ZORINO. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    console.log('Sending goodbye email:', emailContent);
  }

  /**
   * Send newsletter email
   */
  private async sendNewsletterEmail(subscriber: NewsletterSubscriber, campaignId: string): Promise<void> {
    // In production, fetch campaign content and send email
    console.log(`Sending newsletter to ${subscriber.email} for campaign ${campaignId}`);
  }

  /**
   * Save subscriber to storage
   */
  private async saveSubscriber(subscriber: NewsletterSubscriber): Promise<void> {
    const subscribers = this.getLocalSubscribers();
    const existingIndex = subscribers.findIndex(s => s.email === subscriber.email);
    
    if (existingIndex >= 0) {
      subscribers[existingIndex] = subscriber;
    } else {
      subscribers.push(subscriber);
    }
    
    this.saveLocalSubscribers(subscribers);
  }

  /**
   * Get subscribers from local storage
   */
  private getLocalSubscribers(): NewsletterSubscriber[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Save subscribers to local storage
   */
  private saveLocalSubscribers(subscribers: NewsletterSubscriber[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.storageKey, JSON.stringify(subscribers));
  }
}

export const newsletterSystem = new NewsletterSystem();

// React hook for newsletter
export function useNewsletter() {
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [stats, setStats] = useState<any>(null);

  const subscribe = async (email: string, name?: string, locale?: 'en' | 'ar') => {
    setLoading(true);
    const result = await newsletterSystem.subscribe(email, name, locale);
    setSubscribed(true);
    setLoading(false);
    return result;
  };

  const unsubscribe = async (email: string) => {
    setLoading(true);
    const result = await newsletterSystem.unsubscribe(email);
    setSubscribed(false);
    setLoading(false);
    return result;
  };

  const checkSubscription = async (email: string) => {
    const result = await newsletterSystem.isSubscribed(email);
    setSubscribed(result);
    return result;
  };

  const loadStats = async () => {
    const result = await newsletterSystem.getStats();
    setStats(result);
    return result;
  };

  return {
    loading,
    subscribed,
    stats,
    subscribe,
    unsubscribe,
    checkSubscription,
    loadStats,
  };
}
