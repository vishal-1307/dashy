import { createHash } from "node:crypto";
import { z } from "zod";

export const BACKUP_VERSION = 2;

export const backupTaskSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  projectId: z.string().optional().nullable(),
  title: z.string(),
  description: z.string().optional().nullable(),
  status: z.string(),
  priority: z.string(),
  progress: z.number().default(0),
  dueDate: z.string().optional().nullable()
});

export const backupProjectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  status: z.string(),
  priority: z.string(),
  progress: z.number().default(0),
  deadline: z.string().optional().nullable()
});

export const backupClientSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  company: z.string().optional().nullable(),
  dealValue: z.number().default(0),
  stage: z.string()
});

export const backupInvoiceSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  clientId: z.string().optional().nullable(),
  invoiceNumber: z.string(),
  totalAmount: z.number(),
  amountPaid: z.number(),
  outstandingBalance: z.number(),
  status: z.string(),
  dueAt: z.string()
});

export const backupFinanceTxSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  invoiceId: z.string().optional().nullable(),
  idempotencyKey: z.string(),
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number(),
  category: z.string()
});

export const relationalBackupSchema = z.object({
  app: z.literal("dashy"),
  version: z.number().int().min(1),
  exportedAt: z.string(),
  checksum: z.string(),
  data: z.object({
    workspaces: z.array(z.object({ id: z.string(), slug: z.string(), name: z.string() })),
    tasks: z.array(backupTaskSchema),
    projects: z.array(backupProjectSchema),
    clients: z.array(backupClientSchema),
    invoices: z.array(backupInvoiceSchema),
    financeTransactions: z.array(backupFinanceTxSchema),
    notes: z.array(z.object({ id: z.string(), workspaceId: z.string(), title: z.string(), content: z.string() })),
    jobs: z.array(z.object({ id: z.string(), company: z.string(), role: z.string(), status: z.string() }))
  })
});

export type RelationalBackupData = z.infer<typeof relationalBackupSchema>;

/**
 * Computes deterministic SHA-256 checksum over the data object.
 */
export function computeBackupChecksum(data: RelationalBackupData["data"]): string {
  const serialized = JSON.stringify(data);
  return createHash("sha256").update(serialized).digest("hex");
}

/**
 * Generates an exportable relational backup snapshot with integrity checksum.
 */
export function createBackupSnapshot(data: RelationalBackupData["data"]): RelationalBackupData {
  return {
    app: "dashy",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    checksum: computeBackupChecksum(data),
    data
  };
}

export type RestoreValidationResult =
  | { success: true; backup: RelationalBackupData }
  | { success: false; error: string };

/**
 * Validates backup format, checksum integrity, and foreign key boundaries before restoration.
 */
export function validateBackupForRestore(rawJson: unknown): RestoreValidationResult {
  const parseResult = relationalBackupSchema.safeParse(rawJson);
  if (!parseResult.success) {
    return {
      success: false,
      error: `Invalid backup schema: ${parseResult.error.issues[0]?.message || "malformed payload"}`
    };
  }

  const backup = parseResult.data;

  // 1. Checksum verification (anti-corruption)
  const expectedChecksum = computeBackupChecksum(backup.data);
  if (expectedChecksum !== backup.checksum) {
    return {
      success: false,
      error: "Integrity error: Backup checksum mismatch (corrupted or tampered data)"
    };
  }

  // 2. Relational integrity verification (Foreign keys)
  const workspaceIds = new Set(backup.data.workspaces.map((w) => w.id));

  for (const task of backup.data.tasks) {
    if (!workspaceIds.has(task.workspaceId)) {
      return {
        success: false,
        error: `Relational error: Task "${task.title}" references non-existent workspace "${task.workspaceId}"`
      };
    }
  }

  for (const project of backup.data.projects) {
    if (!workspaceIds.has(project.workspaceId)) {
      return {
        success: false,
        error: `Relational error: Project "${project.title}" references non-existent workspace "${project.workspaceId}"`
      };
    }
  }

  for (const invoice of backup.data.invoices) {
    if (!workspaceIds.has(invoice.workspaceId)) {
      return {
        success: false,
        error: `Relational error: Invoice "${invoice.invoiceNumber}" references non-existent workspace "${invoice.workspaceId}"`
      };
    }
  }

  return { success: true, backup };
}
