import { describe, expect, it } from "vitest";
import {
  dateFromDb,
  dateToDb,
  priorityFromDb,
  priorityToDb,
  projectToItem,
  statusFromDb,
  statusToDb,
  taskToItem
} from "../mappers";
import type { Milestone, Project, Task } from "@prisma/client";

describe("Server Actions: Mappers & Helpers", () => {
  describe("dateToDb & dateFromDb", () => {
    it("converts YYYY-MM-DD string to valid Date at UTC midnight", () => {
      const d = dateToDb("2026-10-18");
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toBe("2026-10-18T00:00:00.000Z");
    });

    it("safely handles ISO timestamp strings without corrupting into Invalid Date", () => {
      const iso = "2026-10-18T14:30:00.000Z";
      const d = dateToDb(iso);
      expect(d).toBeInstanceOf(Date);
      expect(d?.toISOString()).toBe(iso);
    });

    it("returns null for null, undefined, or empty string", () => {
      expect(dateToDb(null)).toBeNull();
      expect(dateToDb(undefined)).toBeNull();
      expect(dateToDb("")).toBeNull();
    });

    it("formats Date to YYYY-MM-DD string", () => {
      const d = new Date("2026-10-18T12:00:00.000Z");
      expect(dateFromDb(d)).toBe("2026-10-18");
      expect(dateFromDb(null)).toBeUndefined();
      expect(dateFromDb(undefined)).toBeUndefined();
    });
  });

  describe("priority and status enums", () => {
    it("maps Priority between DB enums and client strings", () => {
      expect(priorityToDb("low")).toBe("LOW");
      expect(priorityToDb("urgent")).toBe("URGENT");
      expect(priorityFromDb("HIGH")).toBe("high");
      expect(priorityFromDb("MEDIUM")).toBe("medium");
    });

    it("maps WorkStatus between DB enums and client strings", () => {
      expect(statusToDb("planned")).toBe("PLANNED");
      expect(statusToDb("active")).toBe("ACTIVE");
      expect(statusToDb("done")).toBe("DONE");
      expect(statusFromDb("PLANNED")).toBe("planned");
      expect(statusFromDb("ARCHIVED")).toBe("archived");
    });
  });

  describe("taskToItem", () => {
    it("transforms raw Prisma Task into frontend WorkspaceItem with subtasks", () => {
      const now = new Date("2026-10-18T08:00:00.000Z");
      const mockTask = {
        id: "task-100",
        userId: "user-1",
        workspaceId: "ws-1",
        projectId: null,
        parentId: null,
        title: "Build auth flow",
        description: "Implement Better Auth and Turnstile",
        status: "ACTIVE",
        priority: "HIGH",
        progress: 50,
        dueDate: new Date("2026-10-25T00:00:00.000Z"),
        previousStatus: "PLANNED",
        createdAt: now,
        updatedAt: now,
        workspace: { slug: "freelance-software" },
        subtasks: [
          {
            id: "sub-1",
            userId: "user-1",
            workspaceId: "ws-1",
            projectId: null,
            parentId: "task-100",
            title: "Add turnstile widget",
            description: null,
            status: "DONE",
            priority: "HIGH",
            progress: 100,
            dueDate: null,
            previousStatus: null,
            createdAt: now,
            updatedAt: now
          }
        ]
      };

      const item = taskToItem(mockTask as unknown as Task & { workspace: { slug: string }; subtasks: Task[] });

      expect(item.id).toBe("task-100");
      expect(item.module).toBe("tasks");
      expect(item.workspace).toBe("freelance-software");
      expect(item.title).toBe("Build auth flow");
      expect(item.status).toBe("active");
      expect(item.priority).toBe("high");
      expect(item.dueDate).toBe("2026-10-25");
      expect(item.subtasks).toHaveLength(1);
      expect(item.subtasks?.[0]).toEqual({
        id: "sub-1",
        title: "Add turnstile widget",
        completed: true
      });
      expect(item.previousStatus).toBe("planned");
    });
  });

  describe("projectToItem", () => {
    it("transforms raw Prisma Project with milestones and blockers", () => {
      const now = new Date("2026-10-18T08:00:00.000Z");
      const mockProject = {
        id: "proj-1",
        userId: "user-1",
        workspaceId: "ws-1",
        title: "Dashy V2 Release",
        description: "Complete full multi-workspace platform",
        status: "ACTIVE",
        priority: "URGENT",
        progress: 80,
        deadline: new Date("2026-10-31T00:00:00.000Z"),
        blockers: "Waiting on DNS\nNeed Neon credentials",
        nextAction: "Complete audit review",
        budget: null,
        targetRevenue: null,
        previousStatus: null,
        createdAt: now,
        updatedAt: now,
        workspace: { slug: "freelance-software" },
        milestones: [
          {
            id: "m-1",
            userId: "user-1",
            projectId: "proj-1",
            title: "Security Hardening",
            status: "DONE",
            dueDate: new Date("2026-10-18T00:00:00.000Z"),
            createdAt: now,
            updatedAt: now
          }
        ]
      };

      const item = projectToItem(mockProject as unknown as Project & { workspace: { slug: string }; milestones: Milestone[] });

      expect(item.id).toBe("proj-1");
      expect(item.module).toBe("projects");
      expect(item.workspace).toBe("freelance-software");
      expect(item.blockers).toEqual(["Waiting on DNS", "Need Neon credentials"]);
      expect(item.nextAction).toBe("Complete audit review");
      expect(item.milestones).toHaveLength(1);
      expect(item.milestones?.[0].completed).toBe(true);
      expect(item.milestones?.[0].dueDate).toBe("2026-10-18");
    });
  });
});
