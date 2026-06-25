"use server";

import {
  deleteUserNotification,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/services/users";
import {
  getNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/services/notifications/preferences";
import { getCurrentUser } from "@/services/users";

async function requireUserId(): Promise<string> {
  const { data: user, error } = await getCurrentUser();
  if (error || !user) throw new Error("Unauthorized");
  return user.id;
}

export async function fetchUserNotifications(unreadOnly = false) {
  const userId = await requireUserId();
  return getUserNotifications(userId, { unreadOnly, limit: 50 });
}

export async function markNotificationAsRead(notificationId: string) {
  const userId = await requireUserId();
  return markNotificationRead(notificationId, userId);
}

export async function markAllNotificationsAsRead() {
  const userId = await requireUserId();
  return markAllNotificationsRead(userId);
}

export async function removeNotification(notificationId: string) {
  const userId = await requireUserId();
  return deleteUserNotification(notificationId, userId);
}

export async function fetchNotificationPreferences() {
  const userId = await requireUserId();
  return getNotificationPreferences(userId);
}

export async function updateNotificationPreferences(prefs: NotificationPreferences) {
  const userId = await requireUserId();
  return saveNotificationPreferences(userId, prefs);
}
