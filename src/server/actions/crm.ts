"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { LeadStage as DbLeadStage } from "@prisma/client";
import type { WorkspaceSlug } from "@/features/workspace/types";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";
import { dateFromDb, dateToDb } from "./mappers";
import { resolveWorkspaceId } from "./workspace-helper";

export type LeadStage =
  | "LEAD"
  | "CONTACTED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export interface ClientLead {
  id: string;
  workspaceId: WorkspaceSlug;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  dealValue: number;
  stage: LeadStage;
  nextFollowUpAt?: string; // YYYY-MM-DD
  notes?: string;
  interactions: { id: string; type: string; summary: string; date: string }[];
}

const createClientSchema = z.object({
  workspace: z.string().default("freelance-software"),
  name: z.string().trim().min(1, "Client name is required").max(200),
  company: z.string().trim().max(200).optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  dealValue: z.number().min(0).default(0),
  stage: z.enum(["LEAD", "CONTACTED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]).default("LEAD"),
  nextFollowUpAt: z.string().optional(),
  notes: z.string().trim().max(5000).optional()
});

const updateClientSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  company: z.string().trim().max(200).optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().trim().max(50).optional(),
  dealValue: z.number().min(0).optional(),
  stage: z.enum(["LEAD", "CONTACTED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]).optional(),
  nextFollowUpAt: z.string().nullable().optional(),
  notes: z.string().trim().max(5000).optional(),
  workspace: z.string().optional()
});

const interactionSchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "WHATSAPP", "NOTE"]).default("CALL"),
  summary: z.string().trim().min(1, "Summary is required").max(2000),
  followUpAt: z.string().optional()
});

function clientToLead(client: {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  dealValue: { toNumber(): number } | number | null;
  stage: DbLeadStage;
  nextFollowUpAt: Date | null;
  requirements: string | null;
  workspace: { slug: string };
  interactions: { id: string; type: string; summary: string; interactionAt: Date }[];
}): ClientLead {
  return {
    id: client.id,
    workspaceId: (client.workspace.slug as WorkspaceSlug) ?? "freelance-software",
    name: client.name,
    company: client.company ?? undefined,
    email: client.email ?? undefined,
    phone: client.phone ?? undefined,
    dealValue: client.dealValue ? (typeof client.dealValue === "number" ? client.dealValue : client.dealValue.toNumber()) : 0,
    stage: client.stage as LeadStage,
    nextFollowUpAt: dateFromDb(client.nextFollowUpAt),
    notes: client.requirements ?? undefined,
    interactions: client.interactions.map((int) => ({
      id: int.id,
      type: int.type,
      summary: int.summary,
      date: dateFromDb(int.interactionAt) ?? new Date().toISOString().slice(0, 10)
    }))
  };
}

export async function listClients(workspaceSlug?: string): Promise<ClientLead[]> {
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

  const clients = await prisma.client.findMany({
    where,
    include: {
      workspace: { select: { slug: true } },
      interactions: { orderBy: { interactionAt: "desc" } }
    },
    orderBy: { updatedAt: "desc" }
  });

  return clients.map(clientToLead);
}

export async function createClient(input: unknown): Promise<ClientLead> {
  const userId = await requireUserId();
  const parsed = createClientSchema.parse(input);

  const workspaceId = await resolveWorkspaceId(userId, parsed.workspace);
  if (!workspaceId) {
    throw new Error("Target workspace does not exist or unauthorized");
  }

  const client = await prisma.client.create({
    data: {
      id: randomUUID(),
      workspaceId,
      name: parsed.name,
      company: parsed.company || null,
      email: parsed.email || null,
      phone: parsed.phone || null,
      dealValue: parsed.dealValue,
      stage: parsed.stage as DbLeadStage,
      nextFollowUpAt: dateToDb(parsed.nextFollowUpAt),
      requirements: parsed.notes || null
    },
    include: {
      workspace: { select: { slug: true } },
      interactions: true
    }
  });

  return clientToLead(client);
}

export async function updateClient(clientId: string, updates: unknown): Promise<ClientLead> {
  const userId = await requireUserId();
  const parsed = updateClientSchema.parse(updates);

  // Check ownership
  const existing = await prisma.client.findFirst({
    where: { id: clientId, workspace: { userId } },
    select: { id: true, workspaceId: true }
  });
  if (!existing) {
    throw new Error("Client not found or unauthorized");
  }

  let nextWorkspaceId: string | undefined = undefined;
  if (parsed.workspace) {
    const resolved = await resolveWorkspaceId(userId, parsed.workspace);
    if (resolved) nextWorkspaceId = resolved;
  }

  const updated = await prisma.client.update({
    where: { id: clientId },
    data: {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.company !== undefined ? { company: parsed.company || null } : {}),
      ...(parsed.email !== undefined ? { email: parsed.email || null } : {}),
      ...(parsed.phone !== undefined ? { phone: parsed.phone || null } : {}),
      ...(parsed.dealValue !== undefined ? { dealValue: parsed.dealValue } : {}),
      ...(parsed.stage !== undefined ? { stage: parsed.stage as DbLeadStage } : {}),
      ...(parsed.nextFollowUpAt !== undefined ? { nextFollowUpAt: dateToDb(parsed.nextFollowUpAt) } : {}),
      ...(parsed.notes !== undefined ? { requirements: parsed.notes || null } : {}),
      ...(nextWorkspaceId ? { workspaceId: nextWorkspaceId } : {})
    },
    include: {
      workspace: { select: { slug: true } },
      interactions: { orderBy: { interactionAt: "desc" } }
    }
  });

  return clientToLead(updated);
}

export async function updateClientStage(clientId: string, stage: LeadStage): Promise<ClientLead> {
  return updateClient(clientId, { stage });
}

export async function deleteClient(clientId: string): Promise<void> {
  const userId = await requireUserId();
  const existing = await prisma.client.findFirst({
    where: { id: clientId, workspace: { userId } }
  });
  if (!existing) {
    throw new Error("Client not found or unauthorized");
  }

  await prisma.client.delete({ where: { id: clientId } });
}

export async function addClientInteraction(
  clientId: string,
  input: unknown
): Promise<{ id: string; type: string; summary: string; date: string }> {
  const userId = await requireUserId();
  const parsed = interactionSchema.parse(input);

  const client = await prisma.client.findFirst({
    where: { id: clientId, workspace: { userId } }
  });
  if (!client) {
    throw new Error("Client not found or unauthorized");
  }

  const interaction = await prisma.clientInteraction.create({
    data: {
      id: randomUUID(),
      clientId,
      type: parsed.type,
      summary: parsed.summary,
      interactionAt: new Date(),
      followUpAt: dateToDb(parsed.followUpAt)
    }
  });

  if (parsed.followUpAt) {
    await prisma.client.update({
      where: { id: clientId },
      data: { nextFollowUpAt: dateToDb(parsed.followUpAt) }
    });
  }

  return {
    id: interaction.id,
    type: interaction.type,
    summary: interaction.summary,
    date: dateFromDb(interaction.interactionAt) ?? new Date().toISOString().slice(0, 10)
  };
}
