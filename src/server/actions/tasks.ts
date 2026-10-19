"use server";

import { randomUUID } from "node:crypto";
import { serverCreateSchema, serverUpdateSchema, workspaceItemSchema } from "@/features/workspace/schema";
import type { WorkspaceItem } from "@/features/workspace/types";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { dateToDb, priorityToDb, statusToDb, taskToItem } from "./mappers";
import { assertUnderQuota } from "./quota";
import { resolveWorkspaceId } from "./workspace-helper";

export async function listTasks(workspaceSlug?: string): Promise<WorkspaceItem[]> {
  const userId = await requireUserId();
  const where: {
    userId: string;
    parentId: null;
    workspace?: { slug: string };
  } = {
    userId,
    parentId: null
  };

  if (workspaceSlug && workspaceSlug !== "unified") {
    where.workspace = { slug: workspaceSlug };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      workspace: { select: { slug: true } },
      subtasks: { orderBy: { createdAt: "asc" } }
    },
    orderBy: { createdAt: "desc" }
  });
  return tasks.map(taskToItem);
}

export async function createTask(input: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const draft = serverCreateSchema.parse(input);
  if (draft.module !== "tasks") {
    throw new Error("createTask received a payload for a different module");
  }
  assertUnderQuota(await prisma.task.count({ where: { userId } }), "tasks");

  const workspaceId = await resolveWorkspaceId(userId, draft.workspace);

  const task = await prisma.task.create({
    data: {
      id: draft.id || randomUUID(),
      userId,
      workspaceId,
      title: draft.title,
      description: draft.description || null,
      priority: priorityToDb(draft.priority),
      status: "PLANNED",
      dueDate: dateToDb(draft.dueDate)
    },
    include: {
      workspace: { select: { slug: true } },
      subtasks: true
    }
  });
  return taskToItem(task);
}

export async function updateTask(id: string, updates: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const changes = serverUpdateSchema.parse(updates);

  let workspaceId: string | null | undefined = undefined;
  if (changes.workspace !== undefined) {
    workspaceId = await resolveWorkspaceId(userId, changes.workspace);
  }

  if (changes.subtasks !== undefined) {
    const existing = await prisma.task.findMany({
      where: { parentId: id, userId },
      select: { id: true }
    });
    const existingIds = new Set(existing.map((t) => t.id));
    const keepIds = new Set(changes.subtasks.map((s) => s.id));

    const toDelete = [...existingIds].filter((subId) => !keepIds.has(subId));
    if (toDelete.length > 0) {
      await prisma.task.deleteMany({
        where: { id: { in: toDelete }, parentId: id, userId }
      });
    }

    for (const sub of changes.subtasks) {
      if (existingIds.has(sub.id)) {
        await prisma.task.update({
          where: { id: sub.id },
          data: {
            title: sub.title,
            status: sub.completed ? "DONE" : "PLANNED"
          }
        });
      } else {
        await prisma.task.create({
          data: {
            id: sub.id,
            userId,
            parentId: id,
            title: sub.title,
            status: sub.completed ? "DONE" : "PLANNED",
            priority: priorityToDb(changes.priority ?? "medium")
          }
        });
      }
    }
  }

  const result = await prisma.task.updateMany({
    where: { id, userId },
    data: {
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.status !== undefined ? { status: statusToDb(changes.status) } : {}),
      ...(changes.priority !== undefined ? { priority: priorityToDb(changes.priority) } : {}),
      ...(changes.progress !== undefined ? { progress: changes.progress } : {}),
      ...(workspaceId !== undefined ? { workspaceId } : {}),
      ...("dueDate" in changes ? { dueDate: dateToDb(changes.dueDate) } : {}),
      ...("previousStatus" in changes
        ? { previousStatus: changes.previousStatus ? statusToDb(changes.previousStatus) : null }
        : {})
    }
  });

  if (result.count === 0) {
    throw new Error("Task not found");
  }

  const task = await prisma.task.findFirstOrThrow({
    where: { id, userId },
    include: {
      workspace: { select: { slug: true } },
      subtasks: { orderBy: { createdAt: "asc" } }
    }
  });
  return taskToItem(task);
}

export async function deleteTask(id: string): Promise<WorkspaceItem | null> {
  const userId = await requireUserId();
  const task = await prisma.task.findFirst({
    where: { id, userId },
    include: {
      workspace: { select: { slug: true } },
      subtasks: true
    }
  });
  if (!task) return null;
  await prisma.task.deleteMany({ where: { id, userId } });
  return taskToItem(task);
}

/** Recreates a task that was optimistically deleted, for the undo toast. */
export async function restoreTask(input: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const item = workspaceItemSchema.parse(input);
  if (item.module !== "tasks") {
    throw new Error("restoreTask received a payload for a different module");
  }
  assertUnderQuota(await prisma.task.count({ where: { userId } }), "tasks");

  const workspaceId = await resolveWorkspaceId(userId, item.workspace);

  await prisma.task.create({
    data: {
      id: item.id,
      userId,
      workspaceId,
      title: item.title,
      description: item.description || null,
      status: statusToDb(item.status),
      previousStatus: item.previousStatus ? statusToDb(item.previousStatus) : null,
      priority: priorityToDb(item.priority),
      dueDate: dateToDb(item.dueDate),
      progress: item.progress
    },
    include: {
      workspace: { select: { slug: true } },
      subtasks: true
    }
  });

  if (item.subtasks && item.subtasks.length > 0) {
    for (const sub of item.subtasks) {
      await prisma.task.create({
        data: {
          id: sub.id,
          userId,
          parentId: item.id,
          title: sub.title,
          status: sub.completed ? "DONE" : "PLANNED",
          priority: priorityToDb(item.priority)
        }
      });
    }
  }

  const finalTask = await prisma.task.findFirstOrThrow({
    where: { id: item.id, userId },
    include: {
      workspace: { select: { slug: true } },
      subtasks: { orderBy: { createdAt: "asc" } }
    }
  });

  return taskToItem(finalTask);
}
