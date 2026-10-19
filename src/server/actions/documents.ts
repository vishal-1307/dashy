"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceSlug } from "@/features/workspace/types";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { dateFromDb } from "./mappers";
import { resolveWorkspaceId } from "./workspace-helper";

export type DocumentCategory =
  | "PROPOSAL"
  | "AGREEMENT"
  | "INVOICE"
  | "REQUIREMENT"
  | "TEMPLATE"
  | "OTHER";

export interface DocumentRecordItem {
  id: string;
  workspaceId: WorkspaceSlug;
  title: string;
  category: DocumentCategory;
  fileUrl?: string;
  fileKey?: string;
  mimeType?: string;
  sizeKb?: number;
  content?: string;
  createdAt: string;
}

const createDocSchema = z.object({
  workspace: z.string().default("freelance-software"),
  title: z.string().trim().min(1, "Title is required").max(300),
  category: z.enum(["PROPOSAL", "AGREEMENT", "INVOICE", "REQUIREMENT", "TEMPLATE", "OTHER"]).default("PROPOSAL"),
  content: z.string().trim().max(10000).optional(),
  fileUrl: z.string().url().optional().or(z.literal("")),
  mimeType: z.string().optional(),
  sizeKb: z.number().optional()
});

function docToRecord(doc: {
  id: string;
  title: string;
  category: string | null;
  fileUrl: string | null;
  fileKey: string | null;
  mimeType: string | null;
  size: number | null;
  content: string | null;
  createdAt: Date;
  workspace: { slug: string } | null;
}): DocumentRecordItem {
  return {
    id: doc.id,
    workspaceId: (doc.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    title: doc.title,
    category: (doc.category as DocumentCategory) || "OTHER",
    fileUrl: doc.fileUrl ?? undefined,
    fileKey: doc.fileKey ?? undefined,
    mimeType: doc.mimeType ?? "text/plain",
    sizeKb: doc.size ? Math.round(doc.size / 1024) : 12,
    content: doc.content ?? undefined,
    createdAt: dateFromDb(doc.createdAt) ?? new Date().toISOString().slice(0, 10)
  };
}

export async function listDocuments(workspaceSlug?: string): Promise<DocumentRecordItem[]> {
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

  const docs = await prisma.document.findMany({
    where,
    include: {
      workspace: { select: { slug: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return docs.map(docToRecord);
}

export async function createDocument(input: unknown): Promise<DocumentRecordItem> {
  const userId = await requireUserId();
  const parsed = createDocSchema.parse(input);

  const workspaceId = await resolveWorkspaceId(userId, parsed.workspace);
  if (!workspaceId) {
    throw new Error("Workspace not found or unauthorized");
  }

  const doc = await prisma.document.create({
    data: {
      id: randomUUID(),
      userId,
      workspaceId,
      title: parsed.title,
      category: parsed.category,
      content: parsed.content || null,
      fileUrl: parsed.fileUrl || null,
      mimeType: parsed.mimeType || "text/markdown",
      size: (parsed.sizeKb || 16) * 1024
    },
    include: {
      workspace: { select: { slug: true } }
    }
  });

  return docToRecord(doc);
}

export async function deleteDocument(id: string): Promise<void> {
  const userId = await requireUserId();
  const existing = await prisma.document.findFirst({
    where: { id, workspace: { userId } }
  });
  if (!existing) {
    throw new Error("Document not found or unauthorized");
  }

  await prisma.document.delete({ where: { id } });
}
