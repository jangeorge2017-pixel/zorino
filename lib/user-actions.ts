"use server";

import {
  deleteUserNotification,
  getNotificationPreferences,
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  saveNotificationPreferences,
  type NotificationPreferences,
} from "@/services/users";

export async function fetchUserNotifications(userId: string) {
  return getUserNotifications(userId, { limit: 50 });
}

export async function fetchNotificationPreferences(userId: string) {
  return getNotificationPreferences(userId);
}

export async function actionMarkNotificationRead(notificationId: string, userId: string) {
  return markNotificationRead(notificationId, userId);
}

export async function actionMarkAllNotificationsRead(userId: string) {
  return markAllNotificationsRead(userId);
}

export async function actionDeleteNotification(notificationId: string, userId: string) {
  return deleteUserNotification(notificationId, userId);
}

export async function actionSaveNotificationPreferences(
  userId: string,
  prefs: NotificationPreferences
) {
  return saveNotificationPreferences(userId, prefs);
}
