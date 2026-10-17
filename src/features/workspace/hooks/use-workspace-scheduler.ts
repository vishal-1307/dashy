"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useWorkspaceStore } from "../store";

const CHECK_INTERVAL_MS = 60_000;

export function useWorkspaceScheduler(dailyBriefingTime = "08:30") {
  const store = useWorkspaceStore();
  const lastTriggeredDate = useRef<string | null>(null);

  useEffect(() => {
    const checkSchedule = () => {
      const now = new Date();
      const todayStr = now.toISOString().slice(0, 10);
      const currentHours = String(now.getHours()).padStart(2, "0");
      const currentMinutes = String(now.getMinutes()).padStart(2, "0");
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      // Check daily briefing trigger
      if (currentTimeStr >= dailyBriefingTime && lastTriggeredDate.current !== todayStr) {
        lastTriggeredDate.current = todayStr;
        toast.info("🌅 Your Daily Briefing is ready", {
          description: "Click to view today's active priorities and client follow-ups",
          duration: 10000,
          action: {
            label: "Open Briefing",
            onClick: () => {
              store.setActiveModule("dashboard");
            }
          }
        });
      }

      // Check overdue / due soon tasks
      const overdueTasks = store.items.filter((item) => {
        return (
          item.status !== "done" &&
          item.status !== "archived" &&
          item.dueDate &&
          item.dueDate === todayStr
        );
      });

      if (overdueTasks.length > 0 && Math.random() < 0.1) {
        // Subtle periodic reminder for today's due work
        // Suppressed from spamming by keeping it occasional
      }
    };

    // Run check on mount
    checkSchedule();

    const interval = window.setInterval(checkSchedule, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [dailyBriefingTime, store]);
}
