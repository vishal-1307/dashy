import { z } from "zod";

export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const itemStatusSchema = z.enum(["idea", "planned", "active", "waiting", "done", "archived"]);
export const moduleKeySchema = z.enum([
  "projects",
  "tasks",
  "calendar",
  "knowledge",
  "notes",
  "ideas",
  "documents",
  "learning",
  "goals",
  "habits",
  "journal",
  "finance",
  "crm",
  "school",
  "ngo",
  "contacts",
  "analytics",
  "settings"
]);

export const quickCaptureSchema = z.object({
  module: moduleKeySchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(4000).optional(),
  priority: prioritySchema.default("medium"),
  dueDate: z.string().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).default([])
});

export type QuickCapturePayload = z.infer<typeof quickCaptureSchema>;
