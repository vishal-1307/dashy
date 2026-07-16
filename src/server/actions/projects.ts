"use server";

import { serverCreateSchema, serverUpdateSchema, workspaceItemSchema } from "@/features/workspace/schema";
import type { WorkspaceItem } from "@/features/workspace/types";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { dateToDb, priorityToDb, projectToItem, statusToDb } from "./mappers";
import { assertUnderQuota } from "./quota";

export async function listProjects(): Promise<WorkspaceItem[]> {
  const userId = await requireUserId();
  const projects = await prisma.project.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return projects.map(projectToItem);
}

export async function createProject(input: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const draft = serverCreateSchema.parse(input);
  if (draft.module !== "projects") {
    throw new Error("createProject received a payload for a different module");
  }
  assertUnderQuota(await prisma.project.count({ where: { userId } }), "projects");

  const project = await prisma.project.create({
    data: {
      id: draft.id,
      userId,
      title: draft.title,
      description: draft.description || null,
      priority: priorityToDb(draft.priority),
      status: "PLANNED",
      deadline: dateToDb(draft.dueDate)
    }
  });
  return projectToItem(project);
}

export async function updateProject(id: string, updates: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const changes = serverUpdateSchema.parse(updates);

  const result = await prisma.project.updateMany({
    where: { id, userId },
    data: {
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.status !== undefined ? { status: statusToDb(changes.status) } : {}),
      ...(changes.priority !== undefined ? { priority: priorityToDb(changes.priority) } : {}),
      ...(changes.progress !== undefined ? { progress: changes.progress } : {}),
      ...("dueDate" in changes ? { deadline: dateToDb(changes.dueDate) } : {}),
      ...("previousStatus" in changes
        ? { previousStatus: changes.previousStatus ? statusToDb(changes.previousStatus) : null }
        : {})
    }
  });

  if (result.count === 0) {
    throw new Error("Project not found");
  }

  const project = await prisma.project.findFirstOrThrow({ where: { id, userId } });
  return projectToItem(project);
}

export async function deleteProject(id: string): Promise<WorkspaceItem | null> {
  const userId = await requireUserId();
  const project = await prisma.project.findFirst({ where: { id, userId } });
  if (!project) return null;
  await prisma.project.deleteMany({ where: { id, userId } });
  return projectToItem(project);
}

/** Recreates a project that was optimistically deleted, for the undo toast. */
export async function restoreProject(input: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const item = workspaceItemSchema.parse(input);
  if (item.module !== "projects") {
    throw new Error("restoreProject received a payload for a different module");
  }
  assertUnderQuota(await prisma.project.count({ where: { userId } }), "projects");

  const project = await prisma.project.create({
    data: {
      id: item.id,
      userId,
      title: item.title,
      description: item.description || null,
      status: statusToDb(item.status),
      previousStatus: item.previousStatus ? statusToDb(item.previousStatus) : null,
      priority: priorityToDb(item.priority),
      deadline: dateToDb(item.dueDate),
      progress: item.progress
    }
  });
  return projectToItem(project);
}
