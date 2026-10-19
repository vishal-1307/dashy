"use server";

import { randomUUID } from "node:crypto";
import { serverCreateSchema, serverUpdateSchema, workspaceItemSchema } from "@/features/workspace/schema";
import type { WorkspaceItem } from "@/features/workspace/types";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { dateToDb, priorityToDb, projectToItem, statusToDb } from "./mappers";
import { assertUnderQuota } from "./quota";
import { resolveWorkspaceId } from "./workspace-helper";

export async function listProjects(workspaceSlug?: string): Promise<WorkspaceItem[]> {
  const userId = await requireUserId();
  const where: {
    userId: string;
    workspace?: { slug: string };
  } = {
    userId
  };

  if (workspaceSlug && workspaceSlug !== "unified") {
    where.workspace = { slug: workspaceSlug };
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      workspace: { select: { slug: true } },
      milestones: { orderBy: { createdAt: "asc" } }
    },
    orderBy: { createdAt: "desc" }
  });
  return projects.map(projectToItem);
}

export async function createProject(input: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const draft = serverCreateSchema.parse(input);
  if (draft.module !== "projects") {
    throw new Error("createProject received a payload for a different module");
  }
  assertUnderQuota(await prisma.project.count({ where: { userId } }), "projects");

  const workspaceId = await resolveWorkspaceId(userId, draft.workspace);

  const project = await prisma.project.create({
    data: {
      id: draft.id || randomUUID(),
      userId,
      workspaceId,
      title: draft.title,
      description: draft.description || null,
      priority: priorityToDb(draft.priority),
      status: "PLANNED",
      deadline: dateToDb(draft.dueDate)
    },
    include: {
      workspace: { select: { slug: true } },
      milestones: true
    }
  });
  return projectToItem(project);
}

export async function updateProject(id: string, updates: unknown): Promise<WorkspaceItem> {
  const userId = await requireUserId();
  const changes = serverUpdateSchema.parse(updates);

  let workspaceId: string | null | undefined = undefined;
  if (changes.workspace !== undefined) {
    workspaceId = await resolveWorkspaceId(userId, changes.workspace);
  }

  if (changes.milestones !== undefined) {
    const existing = await prisma.milestone.findMany({
      where: { projectId: id },
      select: { id: true }
    });
    const existingIds = new Set(existing.map((m) => m.id));
    const keepIds = new Set(changes.milestones.map((m) => m.id));

    const toDelete = [...existingIds].filter((mId) => !keepIds.has(mId));
    if (toDelete.length > 0) {
      await prisma.milestone.deleteMany({
        where: { id: { in: toDelete }, projectId: id }
      });
    }

    for (const m of changes.milestones) {
      if (existingIds.has(m.id)) {
        await prisma.milestone.update({
          where: { id: m.id },
          data: {
            title: m.title,
            status: m.completed ? "DONE" : "PLANNED",
            dueDate: dateToDb(m.dueDate)
          }
        });
      } else {
        await prisma.milestone.create({
          data: {
            id: m.id,
            userId,
            projectId: id,
            title: m.title,
            status: m.completed ? "DONE" : "PLANNED",
            dueDate: dateToDb(m.dueDate)
          }
        });
      }
    }
  }

  const result = await prisma.project.updateMany({
    where: { id, userId },
    data: {
      ...(changes.title !== undefined ? { title: changes.title } : {}),
      ...(changes.description !== undefined ? { description: changes.description } : {}),
      ...(changes.status !== undefined ? { status: statusToDb(changes.status) } : {}),
      ...(changes.priority !== undefined ? { priority: priorityToDb(changes.priority) } : {}),
      ...(changes.progress !== undefined ? { progress: changes.progress } : {}),
      ...(workspaceId !== undefined ? { workspaceId } : {}),
      ...(changes.blockers !== undefined ? { blockers: changes.blockers.join("\n") } : {}),
      ...(changes.nextAction !== undefined ? { nextAction: changes.nextAction } : {}),
      ...("dueDate" in changes ? { deadline: dateToDb(changes.dueDate) } : {}),
      ...("previousStatus" in changes
        ? { previousStatus: changes.previousStatus ? statusToDb(changes.previousStatus) : null }
        : {})
    }
  });

  if (result.count === 0) {
    throw new Error("Project not found");
  }

  const project = await prisma.project.findFirstOrThrow({
    where: { id, userId },
    include: {
      workspace: { select: { slug: true } },
      milestones: { orderBy: { createdAt: "asc" } }
    }
  });
  return projectToItem(project);
}

export async function deleteProject(id: string): Promise<WorkspaceItem | null> {
  const userId = await requireUserId();
  const project = await prisma.project.findFirst({
    where: { id, userId },
    include: {
      workspace: { select: { slug: true } },
      milestones: true
    }
  });
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

  const workspaceId = await resolveWorkspaceId(userId, item.workspace);

  await prisma.project.create({
    data: {
      id: item.id,
      userId,
      workspaceId,
      title: item.title,
      description: item.description || null,
      status: statusToDb(item.status),
      previousStatus: item.previousStatus ? statusToDb(item.previousStatus) : null,
      priority: priorityToDb(item.priority),
      deadline: dateToDb(item.dueDate),
      progress: item.progress,
      blockers: item.blockers ? item.blockers.join("\n") : null,
      nextAction: item.nextAction || null
    },
    include: {
      workspace: { select: { slug: true } },
      milestones: true
    }
  });

  if (item.milestones && item.milestones.length > 0) {
    for (const m of item.milestones) {
      await prisma.milestone.create({
        data: {
          id: m.id,
          userId,
          projectId: item.id,
          title: m.title,
          status: m.completed ? "DONE" : "PLANNED",
          dueDate: dateToDb(m.dueDate)
        }
      });
    }
  }

  const finalProject = await prisma.project.findFirstOrThrow({
    where: { id: item.id, userId },
    include: {
      workspace: { select: { slug: true } },
      milestones: { orderBy: { createdAt: "asc" } }
    }
  });

  return projectToItem(finalProject);
}
