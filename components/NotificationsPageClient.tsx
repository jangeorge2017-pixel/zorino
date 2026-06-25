"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  TrendingDown,
  Tag,
  ShoppingBag,
  AlertCircle,
  Star,
  User,
  Flame,
  DollarSign,
} from "lucide-react";
import type { Notification, NotificationType } from "@/lib/types/entities";
import type { NotificationPreferences } from "@/services/users";
import {
  actionDeleteNotification,
  actionMarkAllNotificationsRead,
  actionMarkNotificationRead,
  actionSaveNotificationPreferences,
  fetchNotificationPreferences,
  fetchUserNotifications,
} from "@/lib/user-actions";

const TYPE_ICONS: Record<
  NotificationType,
  { icon: typeof Bell; iconColor: string; iconBg: string }
> = {
  price_drop: { icon: TrendingDown, iconColor: "text-green-500", iconBg: "bg-green-500/20" },
  coupon: { icon: Tag, iconColor: "text-purple-500", iconBg: "bg-purple-500/20" },
  deal: { icon: ShoppingBag, iconColor: "text-orange-500", iconBg: "bg-orange-500/20" },
  system: { icon: Check, iconColor: "text-blue-500", iconBg: "bg-blue-500/20" },
  review: { icon: Star, iconColor: "text-yellow-500", iconBg: "bg-yellow-500/20" },
  alert: { icon: AlertCircle, iconColor: "text-red-500", iconBg: "bg-red-500/20" },
  trending: { icon: Flame, iconColor: "text-orange-400", iconBg: "bg-orange-500/20" },
  affiliate: { icon: DollarSign, iconColor: "text-emerald-400", iconBg: "bg-emerald-500/20" },
};

function formatTimestamp(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPageClient() {
  const t = useTranslations("notifications");
  const { user } = useAuth();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [prefs, setPrefs] = useState<NotificationPreferences>({
    emailPriceDrops: true,
    emailTrending: true,
    inAppEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [notifResult, prefResult] = await Promise.all([
      fetchUserNotifications(user.id),
      fetchNotificationPreferences(user.id),
    ]);
    setNotifications(notifResult.data);
    if (prefResult.data) setPrefs(prefResult.data);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string) => {
    if (!user) return;
    await actionMarkNotificationRead(id, user.id);
    await load();
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await actionMarkAllNotificationsRead(user.id);
    await load();
  };

  const deleteNotification = async (id: string) => {
    if (!user) return;
    await actionDeleteNotification(id, user.id);
    await load();
  };

  const handleSavePrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    await actionSaveNotificationPreferences(user.id, prefs);
    setSavingPrefs(false);
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">{t("loginRequired")}</h2>
          <p className="text-gray-400 mb-6">{t("loginToViewNotifications")}</p>
          <Button onClick={() => router.push("/auth/login")}>{t("login")}</Button>
        </div>
      </div>
    );
  }

  const filteredNotifications =
    filter === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">{t("title")}</h1>
          <p className="text-gray-400">
            {unreadCount} unread {unreadCount === 1 ? "notification" : "notifications"}
          </p>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilter("all")}
            >
              All ({notifications.length})
            </Button>
            <Button
              variant={filter === "unread" ? "primary" : "outline"}
              size="sm"
              onClick={() => setFilter("unread")}
            >
              Unread ({unreadCount})
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
        </div>

        {loading ? (
          <Card>
            <p className="text-gray-400 text-center py-12">Loading notifications…</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredNotifications.map((notification) => {
              const meta = TYPE_ICONS[notification.type] ?? TYPE_ICONS.system;
              const Icon = meta.icon;
              return (
                <Card
                  key={notification.id}
                  hover
                  className={notification.read ? "" : "border-purple-500/50 bg-purple-500/5"}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-12 h-12 ${meta.iconBg} rounded-lg flex items-center justify-center flex-shrink-0`}
                    >
                      <Icon className={`w-6 h-6 ${meta.iconColor}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between mb-1">
                        <div>
                          <h3 className="text-white font-semibold">{notification.title}</h3>
                          <p className="text-gray-400 text-sm">{notification.message}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {!notification.read && (
                            <div className="w-2 h-2 bg-purple-500 rounded-full" />
                          )}
                          <span className="text-gray-500 text-sm">
                            {formatTimestamp(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        {notification.link && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(notification.link!)}
                          >
                            View
                          </Button>
                        )}
                        {!notification.read && (
                          <Button variant="ghost" size="sm" onClick={() => markAsRead(notification.id)}>
                            <Check className="w-4 h-4 mr-1" />
                            Mark Read
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={() => deleteNotification(notification.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {!loading && filteredNotifications.length === 0 && (
          <Card>
            <div className="text-center py-12">
              <Bell className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No notifications</h3>
              <p className="text-gray-400">
                {filter === "unread"
                  ? "You have no unread notifications"
                  : "You have no notifications yet"}
              </p>
            </div>
          </Card>
        )}

        <Card className="mt-8">
          <h2 className="text-xl font-bold text-white mb-4">Notification Preferences</h2>
          <div className="space-y-4">
            {[
              {
                key: "emailPriceDrops" as const,
                label: "Price drop alerts",
                description: "Email when prices drop on tracked products",
              },
              {
                key: "emailTrending" as const,
                label: "Trending products",
                description: "Email when products are trending today",
              },
              {
                key: "inAppEnabled" as const,
                label: "In-app notifications",
                description: "Show alerts inside Zorino",
              },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between p-4 bg-gray-800/50 rounded-lg"
              >
                <div>
                  <p className="text-white font-medium">{item.label}</p>
                  <p className="text-gray-400 text-sm">{item.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prefs[item.key]}
                    onChange={(e) => setPrefs((p) => ({ ...p, [item.key]: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500" />
                </label>
              </div>
            ))}
          </div>
          <Button className="w-full mt-6" onClick={handleSavePrefs} disabled={savingPrefs}>
            {savingPrefs ? "Saving…" : "Save Preferences"}
          </Button>
        </Card>
      </div>
    </div>
  );
}
