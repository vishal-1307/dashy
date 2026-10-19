import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  BROWSER_NOTIFICATION_STORAGE_KEY,
  checkAndDispatchDeadlineNotifications,
  getNotifiedEventsRegistry,
  getNotificationPermission,
  getPrivacyPreservingNotificationBody,
  hasEventBeenNotified,
  isNotificationSupported,
  NOTIFICATION_DEDUPLICATION_TTL_MS,
  recordNotifiedEvent,
  requestNotificationPermission,
  type DeadlineNotificationCandidate
} from "../browser-notifications";

describe("Browser Notifications Utility", () => {
  let mockStore: Record<string, string> = {};

  const mockLocalStorage = {
    getItem: (key: string) => mockStore[key] ?? null,
    setItem: (key: string, value: string) => {
      mockStore[key] = value;
    },
    removeItem: (key: string) => {
      delete mockStore[key];
    },
    clear: () => {
      mockStore = {};
    }
  };

  const originalWindow = globalThis.window;

  beforeEach(() => {
    mockStore = {};
    // Setup window and localStorage mock for node test runner
    const mockWin = {
      localStorage: mockLocalStorage,
      Notification: undefined as unknown
    };
    // @ts-expect-error mock window
    globalThis.window = mockWin;
    // @ts-expect-error mock localStorage
    globalThis.localStorage = mockLocalStorage;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  describe("Permission & Support Detection", () => {
    it("returns 'unsupported' if window.Notification is missing", () => {
      window.Notification = undefined as unknown as typeof Notification;

      expect(isNotificationSupported()).toBe(false);
      expect(getNotificationPermission()).toBe("unsupported");
    });

    it("returns the exact permission status when supported", () => {
      const mockNotification = {
        permission: "granted" as NotificationPermission,
        requestPermission: vi.fn().mockResolvedValue("granted")
      };
      // @ts-expect-error mock assignment
      window.Notification = mockNotification;

      expect(isNotificationSupported()).toBe(true);
      expect(getNotificationPermission()).toBe("granted");
    });

    it("handles requestNotificationPermission gracefully", async () => {
      const mockNotification = {
        permission: "default" as NotificationPermission,
        requestPermission: vi.fn().mockResolvedValue("granted")
      };
      // @ts-expect-error mock assignment
      window.Notification = mockNotification;

      const result = await requestNotificationPermission();
      expect(result).toBe("granted");
      expect(mockNotification.requestPermission).toHaveBeenCalled();
    });
  });

  describe("Deduplication and TTL", () => {
    it("records notified event IDs into localStorage", () => {
      expect(hasEventBeenNotified("task-123")).toBe(false);
      recordNotifiedEvent("task-123");
      expect(hasEventBeenNotified("task-123")).toBe(true);

      const registry = getNotifiedEventsRegistry();
      expect(registry["task-123"]).toBeTypeOf("number");
    });

    it("prunes event entries older than 7 days", () => {
      const now = Date.now();
      const expiredTime = now - (NOTIFICATION_DEDUPLICATION_TTL_MS + 1000);
      const activeTime = now - 10000;

      mockLocalStorage.setItem(
        BROWSER_NOTIFICATION_STORAGE_KEY,
        JSON.stringify({
          "old-event": expiredTime,
          "active-event": activeTime
        })
      );

      const registry = getNotifiedEventsRegistry();
      expect(registry["old-event"]).toBeUndefined();
      expect(registry["active-event"]).toBe(activeTime);
    });
  });

  describe("Privacy-Preserving Notification Formatting", () => {
    it("generates generic, non-sensitive body for task deadlines", () => {
      const candidate: DeadlineNotificationCandidate = {
        id: "task-99",
        category: "TASK_DUE",
        startAt: "2026-10-19T10:00:00Z"
      };

      const { title, body } = getPrivacyPreservingNotificationBody(candidate);
      expect(title).toBe("Dashy Workspace Reminder");
      expect(body).toContain("task deadline scheduled for today");
      // Must not contain financial or confidential keywords
      expect(body).not.toContain("invoice");
      expect(body).not.toContain("₹");
      expect(body).not.toContain("client");
    });

    it("generates generic body for interviews and general calendar events", () => {
      const interviewCandidate: DeadlineNotificationCandidate = {
        id: "job-1",
        category: "JOB_INTERVIEW",
        startAt: "2026-10-19T15:00:00Z"
      };

      const eventCandidate: DeadlineNotificationCandidate = {
        id: "ev-1",
        category: "CALENDAR_EVENT",
        startAt: "2026-10-19T11:00:00Z"
      };

      expect(getPrivacyPreservingNotificationBody(interviewCandidate).body).toContain("career milestone or interview");
      expect(getPrivacyPreservingNotificationBody(eventCandidate).body).toContain("calendar event coming up today");
    });
  });

  describe("Dispatching Notifications", () => {
    it("dispatches notifications for today's events when permission is granted and deduplicates", () => {
      const constructorMock = vi.fn();
      class MockNotification {
        static permission = "granted";
        constructor(title: string, options: unknown) {
          constructorMock(title, options);
        }
      }
      // @ts-expect-error mock assignment
      window.Notification = MockNotification;

      const today = "2026-10-19";
      const candidates: DeadlineNotificationCandidate[] = [
        { id: "cand-1", category: "TASK_DUE", startAt: `${today}T09:00:00Z` },
        { id: "cand-2", category: "CALENDAR_EVENT", startAt: `${today}T14:00:00Z` },
        { id: "cand-future", category: "TASK_DUE", startAt: "2026-10-25T09:00:00Z" }
      ];

      // First run: should dispatch 2 (future one ignored)
      const count1 = checkAndDispatchDeadlineNotifications(candidates, today);
      expect(count1).toBe(2);
      expect(constructorMock).toHaveBeenCalledTimes(2);

      // Second run with same candidates: should dispatch 0 because of deduplication
      const count2 = checkAndDispatchDeadlineNotifications(candidates, today);
      expect(count2).toBe(0);
      expect(constructorMock).toHaveBeenCalledTimes(2);
    });

    it("does not dispatch if permission is denied or default", () => {
      class MockNotification {
        static permission = "denied";
      }
      // @ts-expect-error mock assignment
      window.Notification = MockNotification;

      const candidates: DeadlineNotificationCandidate[] = [
        { id: "cand-1", category: "TASK_DUE", startAt: "2026-10-19T09:00:00Z" }
      ];

      const count = checkAndDispatchDeadlineNotifications(candidates, "2026-10-19");
      expect(count).toBe(0);
    });
  });
});
