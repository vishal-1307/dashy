"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Bell,
  BellOff
} from "lucide-react";
import { toast } from "sonner";
import {
  createCalendarEvent,
  listCalendarEvents,
  type CalendarEventItem
} from "@/server/actions/calendar";
import {
  checkAndDispatchDeadlineNotifications,
  getNotificationPermission,
  NOTIFICATION_DISCLAIMER,
  requestNotificationPermission,
  type BrowserNotificationStatus,
  type DeadlineNotificationCandidate
} from "../lib/browser-notifications";
import { useWorkspaceStore } from "../store";
import type { WorkspaceSlug } from "../types";
import { WORKSPACE_OPTIONS } from "./dashy-workspace";
import { cn } from "@/shared/lib/utils";

export function CalendarView() {
  const store = useWorkspaceStore();
  const currentWs = store.activeWorkspace;
  const today = new Date();

  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string>(today.toISOString().slice(0, 10));

  const [events, setEvents] = useState<CalendarEventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventDate, setEventDate] = useState(selectedDate);
  const [eventTime, setEventTime] = useState("10:00");
  const [eventDurationMinutes, setEventDurationMinutes] = useState("60");
  const [eventWs, setEventWs] = useState<WorkspaceSlug>(currentWs === "unified" ? "freelance-software" : currentWs);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<BrowserNotificationStatus>("unsupported");

  useEffect(() => {
    setNotificationStatus(getNotificationPermission());
  }, []);

  useEffect(() => {
    if (notificationStatus === "granted" && events.length > 0) {
      const candidates: DeadlineNotificationCandidate[] = events.map((e) => ({
        id: e.id,
        category:
          e.category === "JOB_INTERVIEW"
            ? "JOB_INTERVIEW"
            : e.category === "TASK_DUE"
            ? "TASK_DUE"
            : "CALENDAR_EVENT",
        startAt: e.startAt,
        allDay: e.allDay
      }));
      checkAndDispatchDeadlineNotifications(candidates);
    }
  }, [events, notificationStatus]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listCalendarEvents(currentWs)
      .then((data) => {
        if (active) {
          setEvents(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load calendar events:", err);
          toast.error("Could not load aggregated calendar timeline");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentWs]);

  useEffect(() => {
    if (currentWs !== "unified") {
      setEventWs(currentWs);
    }
  }, [currentWs]);

  // Filter events by workspace
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (currentWs === "unified") return true;
      return e.workspaceId === currentWs;
    });
  }, [events, currentWs]);

  // Calendar math
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay(); // 0 = Sun

  const monthName = new Date(currentYear, currentMonth).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric"
  });

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      toast.error("Please provide an event title");
      return;
    }

    const startIso = `${eventDate}T${eventTime}:00.000Z`;
    const durMins = parseInt(eventDurationMinutes, 10) || 60;
    const endTimestamp = new Date(startIso).getTime() + durMins * 60000;
    const endIso = new Date(endTimestamp).toISOString();

    setIsSubmitting(true);
    try {
      const created = await createCalendarEvent({
        workspace: eventWs,
        title: eventTitle.trim(),
        description: eventDesc.trim() || undefined,
        startAt: startIso,
        endAt: endIso,
        allDay: false
      });

      setEvents((prev) => [...prev, created]);
      setShowAddModal(false);
      setEventTitle("");
      setEventDesc("");
      toast.success(`Event "${created.title}" scheduled`);
    } catch (err) {
      console.error("Create event error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to schedule event");
    } finally {
      setIsSubmitting(false);
    }
  };

  const eventsForSelectedDate = filteredEvents.filter((ev) =>
    ev.startAt.startsWith(selectedDate)
  );

  return (
    <div className="calendar-view">
      {/* Header */}
      <section className="module-header">
        <div className="module-header__icon"><CalendarDays /></div>
        <div>
          <p className="eyebrow">Planning & Schedules / Unified Timeline</p>
          <h1>Interactive Calendar & Agenda</h1>
          <p>Database-backed timeline aggregating calendar appointments, task deadlines, client follow-ups, and invoice due dates.</p>
        </div>
        <button className="primary-button" onClick={() => setShowAddModal(true)}>
          <Plus /> New Event
        </button>
      </section>

      {/* Browser Notification Banner */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
          background: "rgb(var(--surface-strong))",
          border: "1px solid rgb(var(--border))",
          borderRadius: "var(--radius)",
          padding: "0.6rem 0.9rem",
          marginBottom: "1.2rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {notificationStatus === "granted" ? (
              <Bell style={{ width: "1rem", height: "1rem", color: "rgb(var(--accent))" }} />
            ) : notificationStatus === "denied" ? (
              <BellOff style={{ width: "1rem", height: "1rem", color: "var(--danger, #ef4444)" }} />
            ) : (
              <Bell style={{ width: "1rem", height: "1rem", color: "rgb(var(--muted))" }} />
            )}
            <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
              {notificationStatus === "granted"
                ? "Browser Deadline Alerts Active (Active Tab)"
                : notificationStatus === "denied"
                ? "Browser Notifications Blocked"
                : notificationStatus === "unsupported"
                ? "Browser Notifications Unavailable"
                : "Browser Deadline Alerts (Optional)"}
            </span>
          </div>

          <div>
            {notificationStatus === "default" ? (
              <button
                type="button"
                className="secondary-button"
                style={{ fontSize: "0.74rem", padding: "0.2rem 0.6rem" }}
                onClick={async () => {
                  const res = await requestNotificationPermission();
                  setNotificationStatus(res);
                  if (res === "granted") {
                    toast.success("Browser deadline notifications enabled for active tab");
                  } else if (res === "denied") {
                    toast.error("Notifications blocked in browser settings");
                  }
                }}
              >
                <Bell style={{ width: "0.75rem", height: "0.75rem" }} /> Enable Browser Alerts
              </button>
            ) : notificationStatus === "denied" ? (
              <span style={{ fontSize: "0.72rem", color: "rgb(var(--muted))" }}>
                Unblock in browser URL site settings to enable
              </span>
            ) : null}
          </div>
        </div>

        <p style={{ fontSize: "0.72rem", color: "rgb(var(--muted))", margin: 0, lineHeight: 1.4 }}>
          {NOTIFICATION_DISCLAIMER}
        </p>
      </div>

      {/* Main Calendar + Day Agenda Layout */}
      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "rgb(var(--muted))" }}>
          Loading calendar timeline and aggregating deadlines...
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 20rem", gap: "1.5rem", alignItems: "start" }}>
          {/* Month View */}
          <div style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: "var(--radius-lg)", padding: "1.2rem" }}>
            {/* Calendar Navigation */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>{monthName}</h2>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <button type="button" className="icon-button" onClick={handlePrevMonth} title="Previous month">
                  <ChevronLeft style={{ width: "1rem", height: "1rem" }} />
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  style={{ padding: "0.25rem 0.6rem", fontSize: "0.75rem" }}
                  onClick={() => {
                    setCurrentMonth(today.getMonth());
                    setCurrentYear(today.getFullYear());
                    setSelectedDate(today.toISOString().slice(0, 10));
                  }}
                >
                  Today
                </button>
                <button type="button" className="icon-button" onClick={handleNextMonth} title="Next month">
                  <ChevronRight style={{ width: "1rem", height: "1rem" }} />
                </button>
              </div>
            </div>

            {/* Weekday Headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.3rem", textAlign: "center", marginBottom: "0.4rem" }}>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <span key={day} style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgb(var(--muted))" }}>
                  {day}
                </span>
              ))}
            </div>

            {/* Month Day Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.3rem" }}>
              {/* Empty slots for offset */}
              {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                <div key={`empty_${i}`} style={{ minHeight: "4.5rem", background: "transparent" }} />
              ))}

              {/* Month Days */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const dayNum = i + 1;
                const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                const isToday = dateStr === today.toISOString().slice(0, 10);
                const isSelected = dateStr === selectedDate;
                const dayEvents = filteredEvents.filter((ev) => ev.startAt.startsWith(dateStr));

                return (
                  <div
                    key={dayNum}
                    onClick={() => setSelectedDate(dateStr)}
                    style={{
                      minHeight: "4.8rem",
                      border: isSelected ? "2px solid rgb(var(--accent))" : "1px solid rgb(var(--border))",
                      borderRadius: "var(--radius)",
                      padding: "0.35rem",
                      background: isToday ? "rgba(var(--accent), 0.05)" : "rgb(var(--surface-strong))",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.2rem",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <span style={{ fontSize: "0.74rem", fontWeight: isToday ? 800 : 600, color: isToday ? "rgb(var(--accent))" : "inherit" }}>
                      {dayNum}
                    </span>

                    {dayEvents.slice(0, 2).map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          fontSize: "0.6rem",
                          padding: "0.1rem 0.25rem",
                          borderRadius: "var(--radius-sm)",
                          background:
                            ev.category === "JOB_INTERVIEW"
                              ? "#8b5cf6"
                              : ev.category === "INVOICE_DUE"
                              ? "#f59e0b"
                              : ev.category === "CRM_FOLLOWUP"
                              ? "#06b6d4"
                              : ev.category === "TASK_DUE"
                              ? "#3b82f6"
                              : "rgb(var(--accent))",
                          color: "white",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap"
                        }}
                        title={ev.title}
                      >
                        {ev.title}
                      </div>
                    ))}

                    {dayEvents.length > 2 ? (
                      <span style={{ fontSize: "0.58rem", color: "rgb(var(--muted))", fontWeight: 700 }}>
                        +{dayEvents.length - 2} more
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected Day Agenda Rail */}
          <aside style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: "var(--radius-lg)", padding: "1.2rem" }}>
            <div className="section-heading" style={{ marginBottom: "1rem" }}>
              <div>
                <p className="eyebrow">Daily Agenda</p>
                <h2 style={{ fontSize: "1rem" }}>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</h2>
              </div>
              <span style={{ fontSize: "0.72rem", color: "rgb(var(--muted))" }}>{eventsForSelectedDate.length} items</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {eventsForSelectedDate.map((ev) => {
                const ws = WORKSPACE_OPTIONS.find((w) => w.slug === ev.workspaceId);
                const timeDisplay = ev.allDay ? "All Day" : ev.startAt.slice(11, 16);
                return (
                  <div key={ev.id} className="item-card" style={{ padding: "0.75rem" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.7rem", fontWeight: 700, color: "rgb(var(--accent))" }}>
                        <Clock style={{ width: "0.75rem", height: "0.75rem" }} /> {timeDisplay}
                      </span>
                      {ws ? (
                        <span className={cn("workspace-pill-badge", ws.dot)} style={{ fontSize: "0.55rem" }}>
                          {ws.label.split(" ")[0]}
                        </span>
                      ) : null}
                    </div>
                    <strong style={{ fontSize: "0.84rem", display: "block" }}>{ev.title}</strong>
                    {ev.description ? (
                      <p style={{ fontSize: "0.74rem", color: "rgb(var(--muted))", margin: "0.25rem 0 0" }}>
                        {ev.description}
                      </p>
                    ) : null}
                  </div>
                );
              })}

              {eventsForSelectedDate.length === 0 ? (
                <div style={{ padding: "2rem", textAlign: "center", color: "rgb(var(--muted))", fontSize: "0.76rem" }}>
                  No events or deadlines for this date.
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      )}

      {/* Add Event Modal */}
      {showAddModal ? (
        <div className="dialog-wrap" onMouseDown={() => setShowAddModal(false)}>
          <div className="capture-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Schedule</p>
                <h2>Create Calendar Event</h2>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateEvent} style={{ display: "grid", gap: "0.8rem", marginTop: "1rem" }}>
              <label>
                Event Title *
                <input autoFocus placeholder="e.g. Client Kickoff Call / Design Review" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} required />
              </label>

              <div className="form-grid">
                <label>
                  Date *
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
                </label>
                <label>
                  Start Time *
                  <input type="time" value={eventTime} onChange={(e) => setEventTime(e.target.value)} required />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Duration (Minutes)
                  <input type="number" value={eventDurationMinutes} onChange={(e) => setEventDurationMinutes(e.target.value)} />
                </label>
                <label>
                  Workspace
                  <select value={eventWs} onChange={(e) => setEventWs(e.target.value as WorkspaceSlug)}>
                    {WORKSPACE_OPTIONS.filter((w) => w.slug !== "unified").map((w) => (
                      <option key={w.slug} value={w.slug}>{w.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Description / Notes
                <textarea placeholder="e.g. Agenda, meeting link, talking points" value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} />
              </label>

              <button className="primary-button primary-button--full" type="submit" disabled={isSubmitting}>
                <Plus /> {isSubmitting ? "Scheduling..." : "Schedule Event"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
