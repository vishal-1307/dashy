"use server";

import {
  createBackupSnapshot,
  validateBackupForRestore,
  type RelationalBackupData
} from "@/server/backup/backup-engine";
import { prisma } from "@/server/db/client";
import { requireUserId } from "@/server/session";

/**
 * Creates a complete relational backup of the owner's Dashy data,
 * including workspaces, tasks, projects, CRM clients, invoices, finance transactions,
 * notes, and job applications, with a cryptographic SHA-256 checksum.
 */
export async function exportRelationalBackupAction(): Promise<RelationalBackupData> {
  const userId = await requireUserId();

  const [
    workspaces,
    tasks,
    projects,
    clients,
    invoices,
    transactions,
    notes,
    jobs
  ] = await Promise.all([
    prisma.workspace.findMany({
      where: { userId },
      select: { id: true, slug: true, name: true }
    }),
    prisma.task.findMany({
      where: { userId, parentId: null },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        progress: true,
        dueDate: true
      }
    }),
    prisma.project.findMany({
      where: { userId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        status: true,
        priority: true,
        progress: true,
        deadline: true
      }
    }),
    prisma.client.findMany({
      where: { workspace: { userId } },
      select: {
        id: true,
        workspaceId: true,
        name: true,
        company: true,
        dealValue: true,
        stage: true
      }
    }),
    prisma.invoice.findMany({
      where: { workspace: { userId } },
      select: {
        id: true,
        workspaceId: true,
        clientId: true,
        invoiceNumber: true,
        totalAmount: true,
        amountPaid: true,
        outstandingBalance: true,
        status: true,
        dueAt: true
      }
    }),
    prisma.financeTransaction.findMany({
      where: { userId },
      select: {
        id: true,
        workspaceId: true,
        invoiceId: true,
        idempotencyKey: true,
        type: true,
        amount: true,
        category: true
      }
    }),
    prisma.note.findMany({
      where: { userId },
      select: {
        id: true,
        workspaceId: true,
        title: true,
        content: true
      }
    }),
    prisma.jobApplication.findMany({
      where: { userId },
      select: {
        id: true,
        company: true,
        role: true,
        status: true
      }
    })
  ]);

  const defaultWsId = workspaces[0]?.id || "default_ws";

  const backupData: RelationalBackupData["data"] = {
    workspaces: workspaces.map((w) => ({
      id: w.id,
      slug: w.slug,
      name: w.name
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      workspaceId: t.workspaceId || defaultWsId,
      projectId: t.projectId ?? null,
      title: t.title,
      description: t.description ?? null,
      status: t.status,
      priority: t.priority,
      progress: t.progress,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null
    })),
    projects: projects.map((p) => ({
      id: p.id,
      workspaceId: p.workspaceId || defaultWsId,
      title: p.title,
      status: p.status,
      priority: p.priority,
      progress: p.progress,
      deadline: p.deadline ? p.deadline.toISOString().slice(0, 10) : null
    })),
    clients: clients.map((c) => ({
      id: c.id,
      workspaceId: c.workspaceId,
      name: c.name,
      company: c.company ?? null,
      dealValue: c.dealValue ? c.dealValue.toNumber() : 0,
      stage: c.stage
    })),
    invoices: invoices.map((inv) => ({
      id: inv.id,
      workspaceId: inv.workspaceId,
      clientId: inv.clientId ?? null,
      invoiceNumber: inv.invoiceNumber,
      totalAmount: inv.totalAmount.toNumber(),
      amountPaid: inv.amountPaid.toNumber(),
      outstandingBalance: inv.outstandingBalance.toNumber(),
      status: inv.status,
      dueAt: inv.dueAt.toISOString()
    })),
    financeTransactions: transactions.map((tx) => ({
      id: tx.id,
      workspaceId: tx.workspaceId || defaultWsId,
      invoiceId: tx.invoiceId ?? null,
      idempotencyKey: tx.idempotencyKey || tx.id,
      type: tx.type === "INCOME" ? "INCOME" : "EXPENSE",
      amount: tx.amount.toNumber(),
      category: tx.category
    })),
    notes: notes.map((n) => ({
      id: n.id,
      workspaceId: n.workspaceId || defaultWsId,
      title: n.title,
      content: n.content ?? ""
    })),
    jobs: jobs.map((j) => ({
      id: j.id,
      company: j.company,
      role: j.role,
      status: j.status
    }))
  };

  return createBackupSnapshot(backupData);
}

/**
 * Validates cryptographic checksum and foreign key references before restoring
 * a relational backup safely with duplicate avoidance.
 */
export async function restoreRelationalBackupAction(
  rawJson: unknown
): Promise<{ success: boolean; message: string; recordCounts: Record<string, number> }> {
  const userId = await requireUserId();

  const validation = validateBackupForRestore(rawJson);
  if (!validation.success) {
    throw new Error(validation.error);
  }

  const { backup } = validation;
  const counts: Record<string, number> = {
    tasks: backup.data.tasks.length,
    projects: backup.data.projects.length,
    clients: backup.data.clients.length,
    invoices: backup.data.invoices.length,
    financeTransactions: backup.data.financeTransactions.length,
    notes: backup.data.notes.length,
    jobs: backup.data.jobs.length
  };

  // 1. Resolve target workspace mappings for current user
  const userWorkspaces = await prisma.workspace.findMany({
    where: { userId },
    select: { id: true, slug: true, isDefault: true }
  });
  const defaultWorkspace = userWorkspaces.find((w) => w.isDefault) || userWorkspaces[0];
  const wsIdMap = new Map<string, string>();
  for (const bWs of backup.data.workspaces) {
    const match = userWorkspaces.find((w) => w.slug === bWs.slug);
    if (match) {
      wsIdMap.set(bWs.id, match.id);
    }
  }
  const mapWsId = (backupWsId: string | undefined | null): string => {
    if (!backupWsId) return defaultWorkspace?.id || "";
    return wsIdMap.get(backupWsId) || (userWorkspaces.some((w) => w.id === backupWsId) ? backupWsId : defaultWorkspace?.id || "");
  };

  // 2. Perform atomic transactional restoration across all relational tables
  await prisma.$transaction(async (tx) => {
    // A. Projects
    for (const p of backup.data.projects) {
      const wsId = mapWsId(p.workspaceId);
      await tx.project.upsert({
        where: { id: p.id },
        create: {
          id: p.id,
          userId,
          workspaceId: wsId,
          title: p.title,
          status: (p.status as "PLANNED" | "ACTIVE" | "DONE") || "PLANNED",
          priority: (p.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
          progress: p.progress,
          deadline: p.deadline ? new Date(`${p.deadline}T00:00:00.000Z`) : null
        },
        update: {
          title: p.title,
          status: (p.status as "PLANNED" | "ACTIVE" | "DONE") || "PLANNED",
          priority: (p.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
          progress: p.progress,
          deadline: p.deadline ? new Date(`${p.deadline}T00:00:00.000Z`) : null
        }
      });
    }

    // B. Tasks
    for (const t of backup.data.tasks) {
      const wsId = mapWsId(t.workspaceId);
      await tx.task.upsert({
        where: { id: t.id },
        create: {
          id: t.id,
          userId,
          workspaceId: wsId,
          projectId: t.projectId || null,
          title: t.title,
          description: t.description || null,
          status: (t.status as "PLANNED" | "ACTIVE" | "DONE") || "PLANNED",
          priority: (t.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
          progress: t.progress,
          dueDate: t.dueDate ? new Date(`${t.dueDate}T00:00:00.000Z`) : null
        },
        update: {
          title: t.title,
          description: t.description || null,
          status: (t.status as "PLANNED" | "ACTIVE" | "DONE") || "PLANNED",
          priority: (t.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") || "MEDIUM",
          progress: t.progress,
          dueDate: t.dueDate ? new Date(`${t.dueDate}T00:00:00.000Z`) : null
        }
      });
    }

    // C. Clients
    for (const c of backup.data.clients) {
      const wsId = mapWsId(c.workspaceId);
      await tx.client.upsert({
        where: { id: c.id },
        create: {
          id: c.id,
          workspaceId: wsId,
          name: c.name,
          company: c.company || null,
          dealValue: c.dealValue,
          stage: (c.stage as "LEAD" | "CONTACTED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST") || "LEAD"
        },
        update: {
          name: c.name,
          company: c.company || null,
          dealValue: c.dealValue,
          stage: (c.stage as "LEAD" | "CONTACTED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST") || "LEAD"
        }
      });
    }

    // D. Invoices
    for (const inv of backup.data.invoices) {
      const wsId = mapWsId(inv.workspaceId);
          const invStatus = (inv.status === "PARTIAL" ? "PARTIALLY_PAID" : inv.status) as
            | "DRAFT"
            | "SENT"
            | "PARTIALLY_PAID"
            | "PAID"
            | "OVERDUE"
            | "CANCELLED";
          await tx.invoice.upsert({
            where: { id: inv.id },
            create: {
              id: inv.id,
              workspaceId: wsId,
              clientId: inv.clientId || null,
              invoiceNumber: inv.invoiceNumber,
              subtotal: inv.totalAmount,
              totalAmount: inv.totalAmount,
              amountPaid: inv.amountPaid,
              outstandingBalance: inv.outstandingBalance,
              status: invStatus || "SENT",
              dueAt: new Date(inv.dueAt),
              items: []
            },
            update: {
              totalAmount: inv.totalAmount,
              amountPaid: inv.amountPaid,
              outstandingBalance: inv.outstandingBalance,
              status: invStatus || "SENT",
              dueAt: new Date(inv.dueAt)
            }
          });
    }

    // E. Finance Transactions
    for (const ftx of backup.data.financeTransactions) {
      const wsId = mapWsId(ftx.workspaceId);
      await tx.financeTransaction.upsert({
        where: { idempotencyKey: ftx.idempotencyKey },
        create: {
          id: ftx.id,
          userId,
          workspaceId: wsId,
          invoiceId: ftx.invoiceId || null,
          idempotencyKey: ftx.idempotencyKey,
          type: ftx.type,
          amount: ftx.amount,
          category: ftx.category,
          occurredAt: new Date(),
          date: new Date()
        },
        update: {
          amount: ftx.amount,
          category: ftx.category
        }
      });
    }

    // F. Notes
    for (const n of backup.data.notes) {
      const wsId = mapWsId(n.workspaceId);
      await tx.note.upsert({
        where: { id: n.id },
        create: {
          id: n.id,
          userId,
          workspaceId: wsId,
          title: n.title,
          content: n.content
        },
        update: {
          title: n.title,
          content: n.content
        }
      });
    }

    // G. Job Applications
    for (const j of backup.data.jobs) {
      await tx.jobApplication.upsert({
        where: { id: j.id },
        create: {
          id: j.id,
          userId,
          company: j.company,
          role: j.role,
          jobType: "REMOTE",
          status: (j.status as "SAVED" | "APPLIED" | "SCREENING" | "TECHNICAL" | "INTERVIEW" | "OFFER" | "REJECTED") || "APPLIED",
          appliedAt: new Date()
        },
        update: {
          company: j.company,
          role: j.role,
          status: (j.status as "SAVED" | "APPLIED" | "SCREENING" | "TECHNICAL" | "INTERVIEW" | "OFFER" | "REJECTED") || "APPLIED"
        }
      });
    }
  }, { timeout: 30000 });

  return {
    success: true,
    message: `Restored ${Object.values(counts).reduce((a, b) => a + b, 0)} records safely across all 7 modules.`,
    recordCounts: counts
  };
}
