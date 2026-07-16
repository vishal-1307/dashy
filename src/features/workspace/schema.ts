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

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date");

export const quickCaptureSchema = z.object({
  module: moduleKeySchema,
  title: z.string().trim().min(1, "Add a title first").max(160, "Keep the title under 160 characters"),
  description: z.string().trim().max(4000, "Notes are limited to 4000 characters").optional(),
  priority: prioritySchema.default("medium"),
  dueDate: isoDate.optional(),
  tags: z.array(z.string().trim().min(1).max(40)).default([])
});

export type QuickCapturePayload = z.infer<typeof quickCaptureSchema>;

export const workspaceItemSchema = z.object({
  id: z.string().min(1).max(120),
  module: moduleKeySchema,
  title: z.string().max(300),
  description: z.string().max(10000),
  status: itemStatusSchema,
  priority: prioritySchema,
  dueDate: isoDate.optional(),
  progress: z.number().min(0).max(100),
  tags: z.array(z.string().max(60)).max(50),
  linkedProject: z.string().max(300).optional(),
  previousStatus: itemStatusSchema.optional(),
  createdAt: z.string().max(40),
  updatedAt: z.string().max(40)
});

// Server-side validation for DB-backed create/update (Tasks, Projects).
// Reused so the server never trusts a payload just because the client
// already ran quickCaptureSchema — a request could bypass the UI entirely.
export const serverCreateSchema = quickCaptureSchema.extend({
  id: z.string().trim().min(1).max(120)
});

// A key that is absent means "don't touch this field"; a key explicitly set
// to null means "clear it" (used for dueDate/previousStatus). Distinguishing
// the two requires nullable+optional rather than .partial() on the base schema.
export const serverUpdateSchema = z.object({
  title: z.string().trim().min(1, "Add a title first").max(300).optional(),
  description: z.string().trim().max(10000).optional(),
  status: itemStatusSchema.optional(),
  priority: prioritySchema.optional(),
  dueDate: isoDate.nullable().optional(),
  progress: z.number().min(0).max(100).optional(),
  previousStatus: itemStatusSchema.nullable().optional()
});

export const workspaceExportSchema = z.object({
  app: z.literal("dashy"),
  version: z.number().int().min(1),
  exportedAt: z.string().max(40).optional(),
  theme: z.enum(["light", "dark", "system"]).optional(),
  items: z.array(workspaceItemSchema).max(20000),
  dashboardOrder: z.array(z.string().max(120)).max(20000).optional(),
  dashboardVisibleIds: z.array(z.string().max(120)).max(20000).optional()
});
