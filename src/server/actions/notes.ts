"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceSlug } from "@/features/workspace/types";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { dateFromDb } from "./mappers";
import { resolveWorkspaceId } from "./workspace-helper";

export interface NoteItem {
  id: string;
  workspaceId: WorkspaceSlug;
  folderId?: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolderItem {
  id: string;
  workspaceId: WorkspaceSlug;
  name: string;
}

const noteSchema = z.object({
  workspace: z.string().default("freelance-software"),
  folderId: z.string().optional(),
  title: z.string().trim().min(1, "Title is required").max(300),
  content: z.string().default(""),
  tags: z.array(z.string()).default([]),
  isPinned: z.boolean().default(false)
});

const updateNoteSchema = z.object({
  folderId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(300).optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  isPinned: z.boolean().optional(),
  workspace: z.string().optional()
});

const folderSchema = z.object({
  workspace: z.string().default("freelance-software"),
  name: z.string().trim().min(1, "Folder name is required").max(100)
});

function noteToRecord(note: {
  id: string;
  title: string;
  content: string | null;
  folderId: string | null;
  tagsList: string[];
  isPinned: boolean;
  createdAt: Date;
  updatedAt: Date;
  workspace: { slug: string } | null;
}): NoteItem {
  return {
    id: note.id,
    workspaceId: (note.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    folderId: note.folderId ?? undefined,
    title: note.title,
    content: note.content ?? "",
    tags: note.tagsList ?? [],
    isPinned: note.isPinned,
    createdAt: dateFromDb(note.createdAt) ?? new Date().toISOString().slice(0, 10),
    updatedAt: dateFromDb(note.updatedAt) ?? new Date().toISOString().slice(0, 10)
  };
}

export async function listNotes(workspaceSlug?: string): Promise<NoteItem[]> {
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

  const notes = await prisma.note.findMany({
    where,
    include: {
      workspace: { select: { slug: true } }
    },
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }]
  });

  return notes.map(noteToRecord);
}

export async function listFolders(workspaceSlug?: string): Promise<NoteFolderItem[]> {
  const userId = await requireUserId();
  const where: {
    workspace: {
      userId: string;
      slug?: string;
    };
  } = {
    workspace: {
      userId
    }
  };

  if (workspaceSlug && workspaceSlug !== "unified") {
    where.workspace.slug = workspaceSlug;
  }

  const folders = await prisma.noteFolder.findMany({
    where,
    include: {
      workspace: { select: { slug: true } }
    },
    orderBy: { createdAt: "asc" }
  });

  return folders.map((f) => ({
    id: f.id,
    workspaceId: (f.workspace.slug as WorkspaceSlug) ?? "freelance-software",
    name: f.name
  }));
}

export async function createNote(input: unknown): Promise<NoteItem> {
  const userId = await requireUserId();
  const parsed = noteSchema.parse(input);

  const workspaceId = await resolveWorkspaceId(userId, parsed.workspace);
  if (!workspaceId) {
    throw new Error("Workspace not found or unauthorized");
  }

  const note = await prisma.note.create({
    data: {
      id: randomUUID(),
      userId,
      workspaceId,
      folderId: parsed.folderId || null,
      title: parsed.title,
      content: parsed.content || null,
      tagsList: parsed.tags,
      isPinned: parsed.isPinned
    },
    include: {
      workspace: { select: { slug: true } }
    }
  });

  return noteToRecord(note);
}

export async function updateNote(id: string, updates: unknown): Promise<NoteItem> {
  const userId = await requireUserId();
  const parsed = updateNoteSchema.parse(updates);

  const existing = await prisma.note.findFirst({
    where: { id, userId }
  });
  if (!existing) {
    throw new Error("Note not found or unauthorized");
  }

  let nextWorkspaceId: string | undefined = undefined;
  if (parsed.workspace) {
    const resolved = await resolveWorkspaceId(userId, parsed.workspace);
    if (resolved) nextWorkspaceId = resolved;
  }

  const updated = await prisma.note.update({
    where: { id },
    data: {
      ...(parsed.title !== undefined ? { title: parsed.title } : {}),
      ...(parsed.content !== undefined ? { content: parsed.content } : {}),
      ...(parsed.tags !== undefined ? { tagsList: parsed.tags } : {}),
      ...(parsed.isPinned !== undefined ? { isPinned: parsed.isPinned } : {}),
      ...(parsed.folderId !== undefined ? { folderId: parsed.folderId } : {}),
      ...(nextWorkspaceId ? { workspaceId: nextWorkspaceId } : {})
    },
    include: {
      workspace: { select: { slug: true } }
    }
  });

  return noteToRecord(updated);
}

export async function deleteNote(id: string): Promise<void> {
  const userId = await requireUserId();
  const existing = await prisma.note.findFirst({
    where: { id, userId }
  });
  if (!existing) {
    throw new Error("Note not found or unauthorized");
  }

  await prisma.note.delete({ where: { id } });
}

export async function createFolder(input: unknown): Promise<NoteFolderItem> {
  const userId = await requireUserId();
  const parsed = folderSchema.parse(input);

  const workspaceId = await resolveWorkspaceId(userId, parsed.workspace);
  if (!workspaceId) {
    throw new Error("Workspace not found or unauthorized");
  }

  const folder = await prisma.noteFolder.create({
    data: {
      id: randomUUID(),
      workspaceId,
      name: parsed.name
    },
    include: {
      workspace: { select: { slug: true } }
    }
  });

  return {
    id: folder.id,
    workspaceId: (folder.workspace.slug as WorkspaceSlug) ?? "freelance-software",
    name: folder.name
  };
}
