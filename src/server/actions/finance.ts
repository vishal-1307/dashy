"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { WorkspaceSlug } from "@/features/workspace/types";
import { prisma } from "@/server/db/client";
import { deriveInvoiceStatus, validatePaymentApplication } from "@/server/finance/financial-ledger";
import type { FinanceTransactionRecord, InvoiceRecord, InvoiceStatus } from "@/server/finance/types";
import { requireUserId } from "@/server/session";
import { dateToDb } from "./mappers";
import { resolveWorkspaceId } from "./workspace-helper";

const createInvoiceSchema = z.object({
  workspace: z.string().default("freelance-software"),
  invoiceNumber: z.string().trim().min(1, "Invoice number is required").max(100),
  clientName: z.string().trim().max(200).optional(),
  totalAmount: z.number().positive("Total amount must be greater than zero"),
  dueAt: z.string().min(1, "Due date is required"),
  notes: z.string().trim().max(2000).optional()
});

const recordPaymentSchema = z.object({
  invoiceId: z.string().min(1, "Invoice ID is required"),
  amount: z.number().positive("Payment amount must be greater than zero"),
  paymentMethod: z.string().default("UPI"),
  idempotencyKey: z.string().min(1, "Idempotency key is required")
});

const recordExpenseSchema = z.object({
  workspace: z.string().default("freelance-software"),
  amount: z.number().positive("Expense amount must be greater than zero"),
  category: z.string().trim().min(1, "Category is required").max(100),
  description: z.string().trim().max(1000).optional(),
  idempotencyKey: z.string().min(1, "Idempotency key is required")
});

export async function listInvoices(workspaceSlug?: string): Promise<InvoiceRecord[]> {
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

  const invoices = await prisma.invoice.findMany({
    where,
    include: {
      workspace: { select: { slug: true } },
      client: { select: { name: true } }
    },
    orderBy: { issuedAt: "desc" }
  });

  return invoices.map((inv) => ({
    id: inv.id,
    userId,
    workspaceId: (inv.workspace.slug as WorkspaceSlug) ?? "freelance-software",
    clientId: inv.client?.name ?? "Direct Client",
    invoiceNumber: inv.invoiceNumber,
    totalAmount: inv.totalAmount.toNumber(),
    amountPaid: inv.amountPaid.toNumber(),
    outstandingBalance: inv.outstandingBalance.toNumber(),
    status: inv.status as InvoiceStatus,
    dueAt: inv.dueAt,
    paidAt: inv.paidAt ?? undefined,
    createdAt: inv.createdAt
  }));
}

export async function createInvoice(input: unknown): Promise<InvoiceRecord> {
  const userId = await requireUserId();
  const parsed = createInvoiceSchema.parse(input);

  const workspaceId = await resolveWorkspaceId(userId, parsed.workspace);
  if (!workspaceId) {
    throw new Error("Target workspace does not exist or unauthorized");
  }

  // Find or create client if name is provided
  let clientId: string | null = null;
  if (parsed.clientName && parsed.clientName.trim()) {
    let client = await prisma.client.findFirst({
      where: { workspaceId, name: parsed.clientName.trim() },
      select: { id: true }
    });
    if (!client) {
      client = await prisma.client.create({
        data: {
          id: randomUUID(),
          workspaceId,
          name: parsed.clientName.trim(),
          stage: "WON"
        },
        select: { id: true }
      });
    }
    clientId = client.id;
  }

  const dueDate = dateToDb(parsed.dueAt) ?? new Date(Date.now() + 14 * 86400000);

  const invoice = await prisma.invoice.create({
    data: {
      id: randomUUID(),
      workspaceId,
      clientId,
      invoiceNumber: parsed.invoiceNumber,
      subtotal: parsed.totalAmount,
      totalAmount: parsed.totalAmount,
      amountPaid: 0,
      outstandingBalance: parsed.totalAmount,
      status: "SENT",
      dueAt: dueDate,
      notes: parsed.notes || null,
      items: []
    },
    include: {
      workspace: { select: { slug: true } },
      client: { select: { name: true } }
    }
  });

  return {
    id: invoice.id,
    userId,
    workspaceId: (invoice.workspace.slug as WorkspaceSlug) ?? "freelance-software",
    clientId: invoice.client?.name ?? "Direct Client",
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: invoice.totalAmount.toNumber(),
    amountPaid: invoice.amountPaid.toNumber(),
    outstandingBalance: invoice.outstandingBalance.toNumber(),
    status: invoice.status as InvoiceStatus,
    dueAt: invoice.dueAt,
    paidAt: invoice.paidAt ?? undefined,
    createdAt: invoice.createdAt
  };
}

export async function listTransactions(workspaceSlug?: string): Promise<FinanceTransactionRecord[]> {
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

  const transactions = await prisma.financeTransaction.findMany({
    where,
    include: {
      workspace: { select: { slug: true } }
    },
    orderBy: { date: "desc" }
  });

  return transactions.map((tx) => ({
    id: tx.id,
    idempotencyKey: tx.idempotencyKey ?? tx.id,
    userId,
    workspaceId: (tx.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    invoiceId: tx.invoiceId ?? undefined,
    amount: tx.amount.toNumber(),
    type: tx.type === "INCOME" ? "INCOME" : "EXPENSE",
    category: tx.category,
    description: tx.description ?? undefined,
    transactedAt: tx.occurredAt ?? tx.date,
    createdAt: tx.createdAt
  }));
}

export async function recordPayment(input: unknown): Promise<{
  invoice: InvoiceRecord;
  transaction: FinanceTransactionRecord;
  isDuplicate: boolean;
}> {
  const userId = await requireUserId();
  const parsed = recordPaymentSchema.parse(input);

  // 1. Check existing transaction by idempotencyKey to guarantee server-side duplicate prevention
  const existingTx = await prisma.financeTransaction.findUnique({
    where: { idempotencyKey: parsed.idempotencyKey },
    include: {
      workspace: { select: { slug: true } },
      invoice: {
        include: {
          workspace: { select: { slug: true } },
          client: { select: { name: true } }
        }
      }
    }
  });

  if (existingTx && existingTx.invoice) {
    const inv = existingTx.invoice;
    return {
      isDuplicate: true,
      transaction: {
        id: existingTx.id,
        idempotencyKey: existingTx.idempotencyKey!,
        userId,
        workspaceId: (existingTx.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
        invoiceId: existingTx.invoiceId ?? undefined,
        amount: existingTx.amount.toNumber(),
        type: "INCOME",
        category: existingTx.category,
        description: existingTx.description ?? undefined,
        transactedAt: existingTx.occurredAt ?? existingTx.date,
        createdAt: existingTx.createdAt
      },
      invoice: {
        id: inv.id,
        userId,
        workspaceId: (inv.workspace.slug as WorkspaceSlug) ?? "freelance-software",
        clientId: inv.client?.name ?? "Direct Client",
        invoiceNumber: inv.invoiceNumber,
        totalAmount: inv.totalAmount.toNumber(),
        amountPaid: inv.amountPaid.toNumber(),
        outstandingBalance: inv.outstandingBalance.toNumber(),
        status: inv.status as InvoiceStatus,
        dueAt: inv.dueAt,
        paidAt: inv.paidAt ?? undefined,
        createdAt: inv.createdAt
      }
    };
  }

  // 2. Execute transactional invoice update & transaction creation
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findFirst({
        where: { id: parsed.invoiceId, workspace: { userId } },
        include: {
          workspace: { select: { slug: true } },
          client: { select: { name: true } }
        }
      });

      if (!invoice) {
        throw new Error("Invoice not found or unauthorized");
      }

      const currentTotal = invoice.totalAmount.toNumber();
      const currentPaid = invoice.amountPaid.toNumber();
      const currentOutstanding = invoice.outstandingBalance.toNumber();

      const invRecord: InvoiceRecord = {
        id: invoice.id,
        userId,
        workspaceId: invoice.workspace.slug,
        clientId: invoice.clientId,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: currentTotal,
        amountPaid: currentPaid,
        outstandingBalance: currentOutstanding,
        status: invoice.status as InvoiceStatus,
        dueAt: invoice.dueAt,
        createdAt: invoice.createdAt
      };

      const validation = validatePaymentApplication(invRecord, parsed.amount);
      if (!validation.valid) {
        throw new Error(validation.error);
      }

      const newAmountPaid = currentPaid + parsed.amount;
      const derived = deriveInvoiceStatus(currentTotal, newAmountPaid, invoice.dueAt);

      const updatedInvoice = await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amountPaid: newAmountPaid,
          outstandingBalance: derived.outstandingBalance,
          status: derived.status,
          paidAt: derived.paidAt
        },
        include: {
          workspace: { select: { slug: true } },
          client: { select: { name: true } }
        }
      });

      const newTx = await tx.financeTransaction.create({
        data: {
          id: randomUUID(),
          userId,
          workspaceId: invoice.workspaceId,
          invoiceId: invoice.id,
          idempotencyKey: parsed.idempotencyKey,
          type: "INCOME",
          amount: parsed.amount,
          category: `Invoice Payment (${invoice.invoiceNumber})`,
          paymentMethod: parsed.paymentMethod,
          description: `Payment via ${parsed.paymentMethod}`,
          occurredAt: new Date(),
          date: new Date()
        },
        include: {
          workspace: { select: { slug: true } }
        }
      });

      return { updatedInvoice, newTx };
    });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (
      errorObj?.code === "P2002" ||
      errorObj?.message?.includes("Unique constraint") ||
      errorObj?.message?.includes("idempotencyKey")
    ) {
      const raceTx = await prisma.financeTransaction.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: {
          workspace: { select: { slug: true } },
          invoice: {
            include: {
              workspace: { select: { slug: true } },
              client: { select: { name: true } }
            }
          }
        }
      });
      if (raceTx && raceTx.invoice) {
        const inv = raceTx.invoice;
        return {
          isDuplicate: true,
          transaction: {
            id: raceTx.id,
            idempotencyKey: raceTx.idempotencyKey!,
            userId,
            workspaceId: (raceTx.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
            invoiceId: raceTx.invoiceId ?? undefined,
            amount: raceTx.amount.toNumber(),
            type: "INCOME",
            category: raceTx.category,
            description: raceTx.description ?? undefined,
            transactedAt: raceTx.occurredAt ?? raceTx.date,
            createdAt: raceTx.createdAt
          },
          invoice: {
            id: inv.id,
            userId,
            workspaceId: (inv.workspace.slug as WorkspaceSlug) ?? "freelance-software",
            clientId: inv.client?.name ?? "Direct Client",
            invoiceNumber: inv.invoiceNumber,
            totalAmount: inv.totalAmount.toNumber(),
            amountPaid: inv.amountPaid.toNumber(),
            outstandingBalance: inv.outstandingBalance.toNumber(),
            status: inv.status as InvoiceStatus,
            dueAt: inv.dueAt,
            paidAt: inv.paidAt ?? undefined,
            createdAt: inv.createdAt
          }
        };
      }
    }
    throw err;
  }

  return {
    isDuplicate: false,
    invoice: {
      id: result.updatedInvoice.id,
      userId,
      workspaceId: (result.updatedInvoice.workspace.slug as WorkspaceSlug) ?? "freelance-software",
      clientId: result.updatedInvoice.client?.name ?? "Direct Client",
      invoiceNumber: result.updatedInvoice.invoiceNumber,
      totalAmount: result.updatedInvoice.totalAmount.toNumber(),
      amountPaid: result.updatedInvoice.amountPaid.toNumber(),
      outstandingBalance: result.updatedInvoice.outstandingBalance.toNumber(),
      status: result.updatedInvoice.status as InvoiceStatus,
      dueAt: result.updatedInvoice.dueAt,
      paidAt: result.updatedInvoice.paidAt ?? undefined,
      createdAt: result.updatedInvoice.createdAt
    },
    transaction: {
      id: result.newTx.id,
      idempotencyKey: result.newTx.idempotencyKey!,
      userId,
      workspaceId: (result.newTx.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
      invoiceId: result.newTx.invoiceId ?? undefined,
      amount: result.newTx.amount.toNumber(),
      type: "INCOME",
      category: result.newTx.category,
      description: result.newTx.description ?? undefined,
      transactedAt: result.newTx.occurredAt ?? result.newTx.date,
      createdAt: result.newTx.createdAt
    }
  };
}

export async function recordExpense(input: unknown): Promise<{
  transaction: FinanceTransactionRecord;
  isDuplicate: boolean;
}> {
  const userId = await requireUserId();
  const parsed = recordExpenseSchema.parse(input);

  // Idempotency check
  const existingTx = await prisma.financeTransaction.findUnique({
    where: { idempotencyKey: parsed.idempotencyKey },
    include: { workspace: { select: { slug: true } } }
  });

  if (existingTx) {
    return {
      isDuplicate: true,
      transaction: {
        id: existingTx.id,
        idempotencyKey: existingTx.idempotencyKey!,
        userId,
        workspaceId: (existingTx.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
        amount: existingTx.amount.toNumber(),
        type: "EXPENSE",
        category: existingTx.category,
        description: existingTx.description ?? undefined,
        transactedAt: existingTx.occurredAt ?? existingTx.date,
        createdAt: existingTx.createdAt
      }
    };
  }

  const workspaceId = await resolveWorkspaceId(userId, parsed.workspace);

  let newTx;
  try {
    newTx = await prisma.financeTransaction.create({
      data: {
        id: randomUUID(),
        userId,
        workspaceId,
        idempotencyKey: parsed.idempotencyKey,
        type: "EXPENSE",
        amount: parsed.amount,
        category: parsed.category,
        description: parsed.description || null,
        occurredAt: new Date(),
        date: new Date()
      },
      include: {
        workspace: { select: { slug: true } }
      }
    });
  } catch (err: unknown) {
    const errorObj = err as { code?: string; message?: string };
    if (
      errorObj?.code === "P2002" ||
      errorObj?.message?.includes("Unique constraint") ||
      errorObj?.message?.includes("idempotencyKey")
    ) {
      const raceTx = await prisma.financeTransaction.findUnique({
        where: { idempotencyKey: parsed.idempotencyKey },
        include: { workspace: { select: { slug: true } } }
      });
      if (raceTx) {
        return {
          isDuplicate: true,
          transaction: {
            id: raceTx.id,
            idempotencyKey: raceTx.idempotencyKey!,
            userId,
            workspaceId: (raceTx.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
            amount: raceTx.amount.toNumber(),
            type: "EXPENSE",
            category: raceTx.category,
            description: raceTx.description ?? undefined,
            transactedAt: raceTx.occurredAt ?? raceTx.date,
            createdAt: raceTx.createdAt
          }
        };
      }
    }
    throw err;
  }

  return {
    isDuplicate: false,
    transaction: {
      id: newTx.id,
      idempotencyKey: newTx.idempotencyKey!,
      userId,
      workspaceId: (newTx.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
      amount: newTx.amount.toNumber(),
      type: "EXPENSE",
      category: newTx.category,
      description: newTx.description ?? undefined,
      transactedAt: newTx.occurredAt ?? newTx.date,
      createdAt: newTx.createdAt
    }
  };
}
