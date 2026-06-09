import type { CurationNotification } from '../types';
import { DEFAULT_NOTIFICATIONS_KEY } from '../types';

function loadNotifications(): CurationNotification[] {
  try {
    const raw = localStorage.getItem(DEFAULT_NOTIFICATIONS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotifications(notifications: CurationNotification[]): void {
  try {
    localStorage.setItem(DEFAULT_NOTIFICATIONS_KEY, JSON.stringify(notifications.slice(0, 100)));
  } catch {}
}

export function addNotification(
  curationRunId: string,
  type: CurationNotification['type'],
  title: string,
  message: string
): CurationNotification {
  const notification: CurationNotification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    curationRunId,
    type,
    title,
    message,
    status: 'queued',
    createdAt: new Date().toISOString(),
  };
  const notifications = loadNotifications();
  notifications.unshift(notification);
  saveNotifications(notifications);

  try {
    const event = new CustomEvent('ai-curator-notification', { detail: notification });
    window.dispatchEvent(event);
  } catch {}

  return notification;
}

export function markNotificationRead(notificationId: string): void {
  const notifications = loadNotifications();
  const idx = notifications.findIndex((n) => n.id === notificationId);
  if (idx !== -1) {
    notifications[idx].status = 'read';
    saveNotifications(notifications);
  }
}

export function getUnreadNotificationCount(): number {
  return loadNotifications().filter((n) => n.status !== 'read').length;
}

export function getNotificationsForRun(curationRunId: string): CurationNotification[] {
  return loadNotifications().filter((n) => n.curationRunId === curationRunId);
}

export function getAllNotifications(): CurationNotification[] {
  return loadNotifications();
}

export function clearNotifications(): void {
  localStorage.removeItem(DEFAULT_NOTIFICATIONS_KEY);
}
