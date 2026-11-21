import type { Task } from '../types/models';
import { formatDueAt } from './dates';

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function sendLocalNotification(title: string, body: string): void {
  if (!isNotificationSupported() || Notification.permission !== 'granted') return;
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready
        .then((reg) => {
          reg.showNotification(title, {
            body,
            icon: '/logo-192.png',
            badge: '/logo-192.png',
            tag: `lifehub-${Date.now()}`,
          });
        })
        .catch(() => {
          new Notification(title, { body, icon: '/logo-192.png' });
        });
    } else {
      new Notification(title, { body, icon: '/logo-192.png' });
    }
  } catch {
    // Silent fallback if browser blocks notification
  }
}

export function findDueReminders(tasks: Task[]): Task[] {
  const now = Date.now();
  return tasks.filter((t) => {
    if (t.deleted_at || t.status === 'done' || !t.due_at || t.reminder_minutes_before === null) {
      return false;
    }
    if (t.reminder_fired_at) return false;
    const dueMs = new Date(t.due_at).getTime();
    if (Number.isNaN(dueMs)) return false;
    const triggerMs = dueMs - t.reminder_minutes_before * 60_000;
    // Fire if within reminder window (and not more than 24h stale)
    return now >= triggerMs && now - triggerMs < 24 * 60 * 60_000;
  });
}

export function fireTaskReminder(task: Task): void {
  const dueText = formatDueAt(task.due_at);
  sendLocalNotification(
    `Reminder: ${task.title}`,
    dueText ? `Due ${dueText}` : 'Scheduled task reminder from LifeHub'
  );
}
