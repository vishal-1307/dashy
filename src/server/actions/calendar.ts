"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceSlug } from "@/features/workspace/types";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { resolveWorkspaceId } from "./workspace-helper";

export type CalendarEventCategory =
  | "EVENT"
  | "TASK_DUE"
  | "CRM_FOLLOWUP"
  | "INVOICE_DUE"
  | "JOB_INTERVIEW";

export interface CalendarEventItem {
  id: string;
  workspaceId: WorkspaceSlug;
  title: string;
  description?: string;
  startAt: string; // ISO string
  endAt: string;
  allDay: boolean;
  category: CalendarEventCategory;
}

const createEventSchema = z.object({
  workspace: z.string().default("freelance-software"),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().max(1000).optional(),
  startAt: z.string().min(1, "Start time is required"),
  endAt: z.string().min(1, "End time is required"),
  allDay: z.boolean().default(false)
});

export async function listCalendarEvents(workspaceSlug?: string): Promise<CalendarEventItem[]> {
  const userId = await requireUserId();
  const wsFilter = workspaceSlug && workspaceSlug !== "unified" ? workspaceSlug : undefined;

  // 1. Fetch user calendar events
  const calEvents = await prisma.calendarEvent.findMany({
    where: {
      userId,
      ...(wsFilter ? { workspace: { slug: wsFilter } } : {})
    },
    include: {
      workspace: { select: { slug: true } }
    },
    orderBy: { startsAt: "asc" }
  });

  const dedicatedEvents: CalendarEventItem[] = calEvents.map((e) => ({
    id: e.id,
    workspaceId: (e.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    title: e.title,
    description: e.description ?? undefined,
    startAt: (e.startsAt || e.createdAt).toISOString(),
    endAt: (e.endsAt || e.startsAt || e.createdAt).toISOString(),
    allDay: e.allDay,
    category: "EVENT"
  }));

  // 2. Aggregate Task deadlines
  const tasks = await prisma.task.findMany({
    where: {
      userId,
      dueDate: { not: null },
      status: { notIn: ["DONE", "ARCHIVED"] },
      ...(wsFilter ? { workspace: { slug: wsFilter } } : {})
    },
    include: {
      workspace: { select: { slug: true } }
    }
  });

  const taskEvents: CalendarEventItem[] = tasks.map((t) => ({
    id: `task_due_${t.id}`,
    workspaceId: (t.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    title: `Task Due: ${t.title}`,
    description: t.description ?? undefined,
    startAt: t.dueDate!.toISOString(),
    endAt: t.dueDate!.toISOString(),
    allDay: true,
    category: "TASK_DUE"
  }));

  // 3. Aggregate Invoices due
  const invoices = await prisma.invoice.findMany({
    where: {
      workspace: {
        userId,
        ...(wsFilter ? { slug: wsFilter } : {})
      },
      status: { notIn: ["PAID", "CANCELLED"] }
    },
    include: {
      workspace: { select: { slug: true } },
      client: { select: { name: true } }
    }
  });

  const invoiceEvents: CalendarEventItem[] = invoices.map((inv) => ({
    id: `inv_due_${inv.id}`,
    workspaceId: (inv.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    title: `Invoice Due: ${inv.invoiceNumber} (₹${inv.outstandingBalance.toNumber().toLocaleString("en-IN")})`,
    description: `Client: ${inv.client?.name ?? "Direct"}`,
    startAt: inv.dueAt.toISOString(),
    endAt: inv.dueAt.toISOString(),
    allDay: true,
    category: "INVOICE_DUE"
  }));

  // 4. Aggregate CRM follow-up dates
  const clients = await prisma.client.findMany({
    where: {
      workspace: {
        userId,
        ...(wsFilter ? { slug: wsFilter } : {})
      },
      nextFollowUpAt: { not: null },
      stage: { notIn: ["WON", "LOST"] }
    },
    include: {
      workspace: { select: { slug: true } }
    }
  });

  const crmEvents: CalendarEventItem[] = clients.map((c) => ({
    id: `crm_follow_${c.id}`,
    workspaceId: (c.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    title: `CRM Follow-up: ${c.name}${c.company ? ` (${c.company})` : ""}`,
    description: c.requirements ?? undefined,
    startAt: c.nextFollowUpAt!.toISOString(),
    endAt: c.nextFollowUpAt!.toISOString(),
    allDay: true,
    category: "CRM_FOLLOWUP"
  }));

  // 5. Aggregate Job Application follow-up deadlines
  const jobs = await prisma.jobApplication.findMany({
    where: {
      userId,
      followUpDeadline: { not: null },
      status: { notIn: ["REJECTED", "WITHDRAWN"] }
    }
  });

  const jobEvents: CalendarEventItem[] = jobs.map((j) => ({
    id: `job_follow_${j.id}`,
    workspaceId: "personal",
    title: `Job Follow-up: ${j.role} at ${j.company}`,
    description: j.notes ?? undefined,
    startAt: j.followUpDeadline!.toISOString(),
    endAt: j.followUpDeadline!.toISOString(),
    allDay: true,
    category: "JOB_INTERVIEW"
  }));

  // Merge and sort
  const allEvents = [
    ...dedicatedEvents,
    ...taskEvents,
    ...invoiceEvents,
    ...crmEvents,
    ...jobEvents
  ];

  return allEvents.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
}

export async function createCalendarEvent(input: unknown): Promise<CalendarEventItem> {
  const userId = await requireUserId();
  const parsed = createEventSchema.parse(input);

  const workspaceId = await resolveWorkspaceId(userId, parsed.workspace);

  const startDate = new Date(parsed.startAt);
  const endDate = new Date(parsed.endAt);

  const event = await prisma.calendarEvent.create({
    data: {
      id: randomUUID(),
      userId,
      workspaceId,
      title: parsed.title,
      description: parsed.description || null,
      startsAt: startDate,
      endsAt: endDate,
      allDay: parsed.allDay
    },
    include: {
      workspace: { select: { slug: true } }
    }
  });

  return {
    id: event.id,
    workspaceId: (event.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    title: event.title,
    description: event.description ?? undefined,
    startAt: event.startsAt.toISOString(),
    endAt: event.endsAt?.toISOString() ?? event.startsAt.toISOString(),
    allDay: event.allDay,
    category: "EVENT"
  };
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const userId = await requireUserId();
  // Only allow deleting user-created calendar events, not synthetic aggregated events
  if (id.startsWith("task_due_") || id.startsWith("inv_due_") || id.startsWith("crm_follow_") || id.startsWith("job_follow_")) {
    return;
  }

  const existing = await prisma.calendarEvent.findFirst({
    where: { id, userId }
  });
  if (!existing) {
    throw new Error("Calendar event not found or unauthorized");
  }

  await prisma.calendarEvent.delete({ where: { id } });
}
