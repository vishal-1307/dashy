/**
 * Browser Notification API helper for Dashy.
 *
 * Implements client-side deadline alerts for tasks and calendar events with:
 * 1. Explicit and respectful permission management.
 * 2. Handlers for unsupported or denied states.
 * 3. 7-day TTL deduplication to prevent repetitive alerts for the same event.
 * 4. Privacy-respecting notification text (no confidential client names or financial amounts exposed).
 * 5. Transparent disclosures that notifications require an active browser tab (no background Web Push worker).
 */

export type BrowserNotificationStatus = "unsupported" | "default" | "granted" | "denied";

export const BROWSER_NOTIFICATION_STORAGE_KEY = "dashy_notified_deadlines_v1";
export const NOTIFICATION_DEDUPLICATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const NOTIFICATION_DISCLAIMER =
  "Browser notifications require Dashy to be open in an active browser tab. Standard browser notifications do not run as background push workers and will not fire when the browser is closed or your device is asleep.";

export function isNotificationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.Notification !== "undefined" &&
    window.Notification !== null
  );
}

export function getNotificationPermission(): BrowserNotificationStatus {
  if (!isNotificationSupported()) {
    return "unsupported";
  }
  return window.Notification.permission as BrowserNotificationStatus;
}

export async function requestNotificationPermission(): Promise<BrowserNotificationStatus> {
  if (!isNotificationSupported()) {
    return "unsupported";
  }
  try {
    const result = await window.Notification.requestPermission();
    return result as BrowserNotificationStatus;
  } catch (err) {
    console.warn("Failed to request notification permission:", err);
    return window.Notification.permission as BrowserNotificationStatus;
  }
}

/**
 * Retrieves the map of previously notified event IDs and their notification timestamps.
 * Cleans up entries older than 7 days.
 */
export function getNotifiedEventsRegistry(): Record<string, number> {
  if (typeof window === "undefined" || !window.localStorage) {
    return {};
  }

  try {
    const raw = localStorage.getItem(BROWSER_NOTIFICATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    const now = Date.now();
    const cleaned: Record<string, number> = {};

    for (const [id, timestamp] of Object.entries(parsed)) {
      if (typeof timestamp === "number" && now - timestamp < NOTIFICATION_DEDUPLICATION_TTL_MS) {
        cleaned[id] = timestamp;
      }
    }

    // Persist cleaned registry if pruned
    if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
      localStorage.setItem(BROWSER_NOTIFICATION_STORAGE_KEY, JSON.stringify(cleaned));
    }

    return cleaned;
  } catch {
    return {};
  }
}

/**
 * Marks an event ID as notified with the current timestamp.
 */
export function recordNotifiedEvent(id: string): void {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const registry = getNotifiedEventsRegistry();
    registry[id] = Date.now();
    localStorage.setItem(BROWSER_NOTIFICATION_STORAGE_KEY, JSON.stringify(registry));
  } catch (err) {
    console.warn("Could not record notified event:", err);
  }
}

/**
 * Checks if an event ID has already been notified within the deduplication window.
 */
export function hasEventBeenNotified(id: string): boolean {
  const registry = getNotifiedEventsRegistry();
  return typeof registry[id] === "number";
}

export interface DeadlineNotificationCandidate {
  id: string;
  category: "TASK_DUE" | "CALENDAR_EVENT" | "JOB_INTERVIEW" | "OTHER";
  startAt: string; // ISO date string or YYYY-MM-DD
  allDay?: boolean;
}

/**
 * Generates privacy-preserving notification content.
 * Never leaks confidential financial amounts, client names, or proprietary notes.
 */
export function getPrivacyPreservingNotificationBody(candidate: DeadlineNotificationCandidate): {
  title: string;
  body: string;
} {
  const title = "Dashy Workspace Reminder";

  switch (candidate.category) {
    case "TASK_DUE":
      return {
        title,
        body: "You have a task deadline scheduled for today in your workspace."
      };
    case "JOB_INTERVIEW":
      return {
        title,
        body: "You have a career milestone or interview scheduled for today."
      };
    case "CALENDAR_EVENT":
    default:
      return {
        title,
        body: "You have a scheduled calendar event coming up today."
      };
  }
}

/**
 * Checks deadline candidates against today's date and triggers notifications
 * for any unnotified items if permission is granted.
 * Returns the count of notifications dispatched.
 */
export function checkAndDispatchDeadlineNotifications(
  candidates: DeadlineNotificationCandidate[],
  todayIsoDate: string = new Date().toISOString().slice(0, 10)
): number {
  if (getNotificationPermission() !== "granted") {
    return 0;
  }

  let dispatchedCount = 0;

  for (const candidate of candidates) {
    if (!candidate.startAt) continue;

    const eventDatePart = candidate.startAt.slice(0, 10);
    // Only notify for items scheduled for today
    if (eventDatePart === todayIsoDate && !hasEventBeenNotified(candidate.id)) {
      const { title, body } = getPrivacyPreservingNotificationBody(candidate);

      try {
        new window.Notification(title, {
          body,
          tag: `dashy-deadline-${candidate.id}`,
          icon: "/manifest.webmanifest"
        });
        recordNotifiedEvent(candidate.id);
        dispatchedCount++;
      } catch (err) {
        console.warn("Failed to fire Notification:", err);
      }
    }
  }

  return dispatchedCount;
}
