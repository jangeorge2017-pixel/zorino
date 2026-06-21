'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Bell, Check, CheckCheck, Trash2, TrendingDown, Tag, ShoppingBag, AlertCircle, Star, User } from 'lucide-react';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const { user } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const notifications = [
    {
      id: 1,
      type: 'price_drop' as const,
      title: 'Price Drop Alert',
      message: 'iPhone 15 Pro Max dropped from $1199 to $999 on Amazon',
      icon: TrendingDown,
      iconColor: 'text-green-500',
      iconBg: 'bg-green-500/20',
      unread: true,
      timestamp: '2 hours ago',
      actionUrl: '/product/1',
    },
    {
      id: 2,
      type: 'coupon' as const,
      title: 'New Coupon Available',
      message: 'Save 20% on electronics with code SAVE20 on Amazon',
      icon: Tag,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/20',
      unread: true,
      timestamp: '5 hours ago',
      actionUrl: '/coupons',
    },
    {
      id: 3,
      type: 'deal' as const,
      title: 'Flash Sale Started',
      message: 'Noon flash sale: 30% off everything for 24 hours only',
      icon: ShoppingBag,
      iconColor: 'text-orange-500',
      iconBg: 'bg-orange-500/20',
      unread: true,
      timestamp: '1 day ago',
      actionUrl: '/deals',
    },
    {
      id: 4,
      type: 'system' as const,
      title: 'Account Verified',
      message: 'Your email address has been successfully verified',
      icon: Check,
      iconColor: 'text-blue-500',
      iconBg: 'bg-blue-500/20',
      unread: false,
      timestamp: '2 days ago',
      actionUrl: '/profile',
    },
    {
      id: 5,
      type: 'review' as const,
      title: 'Review Reminder',
      message: 'How was your experience with the MacBook Air M3? Leave a review!',
      icon: Star,
      iconColor: 'text-yellow-500',
      iconBg: 'bg-yellow-500/20',
      unread: false,
      timestamp: '3 days ago',
      actionUrl: '/product/2',
    },
    {
      id: 6,
      type: 'alert' as const,
      title: 'Low Stock Alert',
      message: 'Sony WH-1000XM5 is running low on stock at Amazon',
      icon: AlertCircle,
      iconColor: 'text-red-500',
      iconBg: 'bg-red-500/20',
      unread: false,
      timestamp: '4 days ago',
      actionUrl: '/product/3',
    },
    {
      id: 7,
      type: 'system' as const,
      title: 'Welcome to ZORINO',
      message: 'Thanks for joining! Start exploring deals and save money.',
      icon: User,
      iconColor: 'text-purple-500',
      iconBg: 'bg-purple-500/20',
      unread: false,
      timestamp: '1 week ago',
      actionUrl: '/',
    },
  ];

  const unreadCount = notifications.filter(n => n.unread).length;

  const markAsRead = (id: number) => {
    // Implement mark as read logic
  };

  const markAllAsRead = () => {
    // Implement mark all as read logic
  };

  const deleteNotification = (id: number) => {
    // Implement delete logic
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t('loginRequired')}</h2>
          <p className="text-gray-400 mb-6">{t('loginToViewNotifications')}</p>
          <Button onClick={() => router.push('/auth/login')}>{t('login')}</Button>
        </div>
      </div>
    );
  }

  const filteredNotifications = filter === 'unread' 
    ? notifications.filter(n => n.unread)
    : notifications;

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t('title')}</h1>
          <p className="text-gray-400">
            {unreadCount} unread {unreadCount === 1 ? 'notification' : 'notifications'}
          </p>
        </div>

        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              All ({notifications.length})
            </Button>
            <Button
              variant={filter === 'unread' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setFilter('unread')}
            >
              Unread ({unreadCount})
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={markAllAsRead}>
              <CheckCheck className="w-4 h-4 mr-2" />
              Mark All Read
            </Button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {filteredNotifications.map((notification) => (
            <Card 
              key={notification.id} 
              hover
              className={`${notification.unread ? 'border-purple-500/50 bg-purple-500/5' : ''}`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 ${notification.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <notification.icon className={`w-6 h-6 ${notification.iconColor}`} />
                </div>
                
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <h3 className="text-white font-semibold">{notification.title}</h3>
                      <p className="text-gray-400 text-sm">{notification.message}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {notification.unread && (
                        <div className="w-2 h-2 bg-purple-500 rounded-full" />
                      )}
                      <span className="text-gray-500 text-sm">{notification.timestamp}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => router.push(notification.actionUrl)}
                    >
                      View
                    </Button>
                    {notification.unread && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                      >
                        <Check className="w-4 h-4 mr-1" />
                        Mark Read
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => deleteNotification(notification.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredNotifications.length === 0 && (
          <Card>
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No notifications</h3>
              <p className="text-gray-400">
                {filter === 'unread' ? 'You have no unread notifications' : 'You have no notifications yet'}
              </p>
            </div>
          </Card>
        )}

        {/* Notification Settings */}
        <Card className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">Notification Preferences</h2>
          <div className="space-y-4">
            {[
              { label: 'Price drop alerts', description: 'Get notified when prices drop on your wishlist items' },
              { label: 'New deals', description: 'Receive notifications about new deals in your favorite categories' },
              { label: 'Coupon codes', description: 'Get alerts when new coupon codes are available' },
              { label: 'Low stock alerts', description: 'Notify when wishlist items are running low on stock' },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">{item.label}</p>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked={index < 3} className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500" />
                </label>
              </div>
            ))}
          </div>
          <Button className="w-full mt-6">Save Preferences</Button>
        </Card>
      </div>
    </div>
  );
}
