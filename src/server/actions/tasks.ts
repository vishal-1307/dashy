"use server";

import { randomUUID } from "node:crypto";
import { serverCreateSchema, serverUpdateSchema, workspaceItemSchema } from "@/features/workspace/schema";
import type { WorkspaceItem } from "@/features/workspace/types";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { dateToDb, priorityToDb, statusToDb, taskToItem } from "./mappers";
import { assertUnderQuota } from "./quota";

export async function listTasks(): Promise<WorkspaceItem[]> {
  const userId = await requireUserId();
  const tasks = await prisma.task.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return tasks.map(taskToItem);
}

export async function createTask(input: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const draft = serverCreateSchema.parse(input);
  if (draft.module !== "tasks") {
    throw new Error("createTask received a payload for a different module");
  }
  assertUnderQuota(await prisma.task.count({ where: { userId } }), "tasks");

  const task = await prisma.task.create({
    data: {
      id: randomUUID(),
      userId,
      title: draft.title,
      description: draft.description || null,
      priority: priorityToDb(draft.priority),
      status: "PLANNED",
      dueDate: dateToDb(draft.dueDate)
    }
  });
  return taskToItem(task);
}

export async function updateTask(id: string, updates: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const changes = serverUpdateSchema.parse(updates);

  const result = await prisma.task.updateMany({
    where: { id, userId },
    data: {
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.status !== undefined ? { status: statusToDb(changes.status) } : {}),
      ...(changes.priority !== undefined ? { priority: priorityToDb(changes.priority) } : {}),
      ...(changes.progress !== undefined ? { progress: changes.progress } : {}),
      ...("dueDate" in changes ? { dueDate: dateToDb(changes.dueDate) } : {}),
      ...("previousStatus" in changes
        ? { previousStatus: changes.previousStatus ? statusToDb(changes.previousStatus) : null }
        : {})
    }
  });

  if (result.count === 0) {
    throw new Error("Task not found");
  }

  const task = await prisma.task.findFirstOrThrow({ where: { id, userId } });
  return taskToItem(task);
}

export async function deleteTask(id: string): Promise<WorkspaceItem | null> {
  const userId = await requireUserId();
  const task = await prisma.task.findFirst({ where: { id, userId } });
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

  const task = await prisma.task.create({
    data: {
      id: item.id,
      userId,
      title: item.title,
      description: item.description || null,
      status: statusToDb(item.status),
      previousStatus: item.previousStatus ? statusToDb(item.previousStatus) : null,
      priority: priorityToDb(item.priority),
      dueDate: dateToDb(item.dueDate),
      progress: item.progress
    }
  });
  return taskToItem(task);
}
