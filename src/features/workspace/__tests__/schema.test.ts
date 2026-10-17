import { describe, expect, it } from "vitest";
import { quickCaptureSchema, serverCreateSchema, serverUpdateSchema } from "../schema";

describe("Workspace Schema Validation", () => {
  it("validates a standard task quick capture payload", () => {
    const valid = quickCaptureSchema.safeParse({
      module: "tasks",
      title: "Write design doc",
      priority: "high",
      dueDate: "2026-10-20",
      tags: ["work", "planning"]
    });
    expect(valid.success).toBe(true);
  });

  it("rejects quick capture payload with empty title", () => {
    const invalid = quickCaptureSchema.safeParse({
      module: "tasks",
      title: "   ",
      priority: "medium"
    });
    expect(invalid.success).toBe(false);
  });

  it("rejects quick capture payload with invalid ISO date format", () => {
    const invalid = quickCaptureSchema.safeParse({
      module: "tasks",
      title: "Task with bad date",
      dueDate: "20-10-2026"
    });
    expect(invalid.success).toBe(false);
  });

  it("requires id on serverCreateSchema", () => {
    const withoutId = serverCreateSchema.safeParse({
      module: "projects",
      title: "New Project"
    });
    expect(withoutId.success).toBe(false);

    const withId = serverCreateSchema.safeParse({
      id: "proj-1234",
      module: "projects",
      title: "New Project"
    });
    expect(withId.success).toBe(true);
  });

  it("validates serverUpdateSchema partial changes", () => {
    const update = serverUpdateSchema.safeParse({
      title: "Updated Title",
      status: "done",
      progress: 100
    });
    expect(update.success).toBe(true);
  });
});
