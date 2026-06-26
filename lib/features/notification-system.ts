// Notification System (Email and In-App)
// This file implements the notification system for email and in-app notifications

import { useState } from 'react';
import { getSiteUrl } from '@/lib/site-url';

export interface Notification {
  id: string;
  userId: string;
  type: 'price_drop' | 'coupon' | 'deal' | 'system' | 'review' | 'alert';
  title: string;
  titleAr?: string;
  message: string;
  messageAr?: string;
  data?: Record<string, any>;
  read: boolean;
  createdAt: Date;
  readAt?: Date;
}

export interface EmailNotification {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class NotificationSystem {
  private storageKey = 'zorino_notifications';

  /**
   * Create a notification
   */
  async createNotification(notification: Omit<Notification, 'id' | 'read' | 'createdAt'>): Promise<Notification> {
    const newNotification: Notification = {
      ...notification,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      read: false,
      createdAt: new Date(),
    };

    // In production, save to database
    await this.saveNotification(newNotification);

    // Send email notification if enabled
    await this.sendEmailNotification(newNotification);

    return newNotification;
  }

  /**
   * Get notifications for a user
   */
  async getNotifications(userId: string, unreadOnly: boolean = false): Promise<Notification[]> {
    const notifications = this.getLocalNotifications(userId);
    
    if (unreadOnly) {
      return notifications.filter(n => !n.read);
    }

    return notifications;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string, userId: string): Promise<boolean> {
    const notifications = this.getLocalNotifications(userId);
    const notification = notifications.find(n => n.id === notificationId);
    
    if (!notification) return false;

    notification.read = true;
    notification.readAt = new Date();
    this.saveLocalNotifications(userId, notifications);
    return true;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId: string): Promise<void> {
    const notifications = this.getLocalNotifications(userId);
    notifications.forEach(n => {
      n.read = true;
      n.readAt = new Date();
    });
    this.saveLocalNotifications(userId, notifications);
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string, userId: string): Promise<boolean> {
    const notifications = this.getLocalNotifications(userId);
    const filtered = notifications.filter(n => n.id !== notificationId);
    
    if (filtered.length === notifications.length) return false;

    this.saveLocalNotifications(userId, filtered);
    return true;
  }

  /**
   * Get unread count
   */
  async getUnreadCount(userId: string): Promise<number> {
    const notifications = this.getLocalNotifications(userId);
    return notifications.filter(n => !n.read).length;
  }

  /**
   * Send price drop notification
   */
  async sendPriceDropNotification(
    userId: string,
    productId: string,
    productName: string,
    oldPrice: number,
    newPrice: number,
    currency: string
  ): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'price_drop',
      title: 'Price Drop Alert!',
      titleAr: 'تنبيه انخفاض السعر!',
      message: `${productName} price dropped from ${currency}${oldPrice} to ${currency}${newPrice}`,
      messageAr: `انخفض سعر ${productName} من ${currency}${oldPrice} إلى ${currency}${newPrice}`,
      data: { productId, oldPrice, newPrice, currency },
    });
  }

  /**
   * Send coupon notification
   */
  async sendCouponNotification(
    userId: string,
    couponCode: string,
    discount: number,
    store: string
  ): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'coupon',
      title: 'New Coupon Available!',
      titleAr: 'كوبون جديد متاح!',
      message: `Use code ${couponCode} for ${discount}% off at ${store}`,
      messageAr: `استخدم الكود ${couponCode} للحصول على خصم ${discount}% من ${store}`,
      data: { couponCode, discount, store },
    });
  }

  /**
   * Send deal notification
   */
  async sendDealNotification(
    userId: string,
    dealTitle: string,
    discount: number,
    store: string
  ): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'deal',
      title: 'Hot Deal Available!',
      titleAr: 'عرض ساخن متاح!',
      message: `${discount}% off on ${dealTitle} at ${store}`,
      messageAr: `خصم ${discount}% على ${dealTitle} من ${store}`,
      data: { dealTitle, discount, store },
    });
  }

  /**
   * Send system notification
   */
  async sendSystemNotification(
    userId: string,
    title: string,
    message: string,
    titleAr?: string,
    messageAr?: string
  ): Promise<Notification> {
    return await this.createNotification({
      userId,
      type: 'system',
      title,
      titleAr,
      message,
      messageAr,
    });
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(notification: Notification): Promise<void> {
    // In production, send email using SMTP service
    const emailContent = this.generateEmailContent(notification);
    console.log('Sending email notification:', emailContent);
  }

  /**
   * Generate email content from notification
   */
  private generateEmailContent(notification: Notification): EmailNotification {
    const subject = notification.titleAr 
      ? `${notification.title} / ${notification.titleAr}`
      : notification.title;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #8b5cf6, #3b82f6); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 20px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; padding: 12px 24px; background: #8b5cf6; color: white; text-decoration: none; border-radius: 5px; margin-top: 15px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ZORINO</h1>
          </div>
          <div class="content">
            <h2>${subject}</h2>
            <p>${notification.message}</p>
            <a href="${getSiteUrl()}" class="button">View on ZORINO</a>
          </div>
          <div class="footer">
            <p>You received this email because you subscribed to ZORINO notifications.</p>
            <p>&copy; ${new Date().getFullYear()} ZORINO. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return {
      to: '', // Would be user's email
      subject,
      html,
    };
  }

  /**
   * Save notification to storage
   */
  private async saveNotification(notification: Notification): Promise<void> {
    // In production, save to database
    const notifications = this.getLocalNotifications(notification.userId);
    notifications.unshift(notification);
    this.saveLocalNotifications(notification.userId, notifications);
  }

  /**
   * Get notifications from local storage
   */
  private getLocalNotifications(userId: string): Notification[] {
    if (typeof window === 'undefined') return [];
    const data = localStorage.getItem(`${this.storageKey}_${userId}`);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Save notifications to local storage
   */
  private saveLocalNotifications(userId: string, notifications: Notification[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(`${this.storageKey}_${userId}`, JSON.stringify(notifications));
  }
}

export const notificationSystem = new NotificationSystem();

// React hook for notifications
export function useNotifications(userId: string) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async (unreadOnly: boolean = false) => {
    setLoading(true);
    const data = await notificationSystem.getNotifications(userId, unreadOnly);
    setNotifications(data);
    setUnreadCount(await notificationSystem.getUnreadCount(userId));
    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    await notificationSystem.markAsRead(notificationId, userId);
    await loadNotifications();
  };

  const markAllAsRead = async () => {
    await notificationSystem.markAllAsRead(userId);
    await loadNotifications();
  };

  const deleteNotification = async (notificationId: string) => {
    await notificationSystem.deleteNotification(notificationId, userId);
    await loadNotifications();
  };

  const sendPriceDropAlert = async (
    productId: string,
    productName: string,
    oldPrice: number,
    newPrice: number,
    currency: string
  ) => {
    return await notificationSystem.sendPriceDropNotification(
      userId,
      productId,
      productName,
      oldPrice,
      newPrice,
      currency
    );
  };

  const sendCouponAlert = async (couponCode: string, discount: number, store: string) => {
    return await notificationSystem.sendCouponNotification(userId, couponCode, discount, store);
  };

  const sendDealAlert = async (dealTitle: string, discount: number, store: string) => {
    return await notificationSystem.sendDealNotification(userId, dealTitle, discount, store);
  };

  return {
    notifications,
    unreadCount,
    loading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    sendPriceDropAlert,
    sendCouponAlert,
    sendDealAlert,
  };
}
