import { describe, expect, it } from "vitest";
import {
  computeBackupChecksum,
  createBackupSnapshot,
  validateBackupForRestore,
  type RelationalBackupData
} from "@/server/backup/backup-engine";

describe("Relational Backup & Restore Engine", () => {
  const validData: RelationalBackupData["data"] = {
    workspaces: [
      { id: "ws-1", slug: "freelance-software", name: "Freelance & Software Development" },
      { id: "ws-2", slug: "dkom", name: "DKOM" }
    ],
    tasks: [
      {
        id: "task-1",
        workspaceId: "ws-1",
        projectId: "proj-1",
        title: "Test Task",
        description: "Task description",
        status: "PLANNED",
        priority: "HIGH",
        progress: 0,
        dueDate: "2026-10-25"
      }
    ],
    projects: [
      {
        id: "proj-1",
        workspaceId: "ws-1",
        title: "Test Project",
        status: "ACTIVE",
        priority: "HIGH",
        progress: 50,
        deadline: "2026-10-31"
      }
    ],
    clients: [
      {
        id: "client-1",
        workspaceId: "ws-1",
        name: "Acme Corp",
        company: "Acme",
        dealValue: 75000,
        stage: "PROPOSAL_SENT"
      }
    ],
    invoices: [
      {
        id: "inv-1",
        workspaceId: "ws-1",
        clientId: "client-1",
        invoiceNumber: "INV-2026-001",
        totalAmount: 75000,
        amountPaid: 25000,
        outstandingBalance: 50000,
        status: "PARTIAL",
        dueAt: "2026-11-01T00:00:00.000Z"
      }
    ],
    financeTransactions: [
      {
        id: "tx-1",
        workspaceId: "ws-1",
        invoiceId: "inv-1",
        idempotencyKey: "pay_inv-1_advance",
        type: "INCOME",
        amount: 25000,
        category: "Invoice Payment"
      }
    ],
    notes: [
      {
        id: "note-1",
        workspaceId: "ws-1",
        title: "Kickoff Notes",
        content: "# Scope of Work\n- Deliverables"
      }
    ],
    jobs: [
      {
        id: "job-1",
        company: "Tech Giant",
        role: "Staff Engineer",
        status: "APPLIED"
      }
    ]
  };

  it("creates a snapshot with accurate SHA-256 checksum and version metadata", () => {
    const snapshot = createBackupSnapshot(validData);

    expect(snapshot.app).toBe("dashy");
    expect(snapshot.version).toBe(2);
    expect(snapshot.checksum).toHaveLength(64); // SHA-256 hex string
    expect(snapshot.data.tasks).toHaveLength(1);
    expect(snapshot.data.invoices).toHaveLength(1);
    expect(snapshot.data.clients).toHaveLength(1);
    expect(snapshot.data.financeTransactions).toHaveLength(1);
  });

  it("validates a genuine untouched backup successfully", () => {
    const snapshot = createBackupSnapshot(validData);
    const result = validateBackupForRestore(snapshot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.backup.data.tasks[0].title).toBe("Test Task");
    }
  });

  it("rejects backup when payload content was tampered with", () => {
    const snapshot = createBackupSnapshot(validData);
    // Tamper with the amount after checksum generation
    snapshot.data.invoices[0].totalAmount = 999999;

    const result = validateBackupForRestore(snapshot);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Integrity error: Backup checksum mismatch");
    }
  });

  it("rejects backup when task references a non-existent workspace", () => {
    const corruptedData: RelationalBackupData["data"] = {
      ...validData,
      tasks: [
        {
          ...validData.tasks[0],
          workspaceId: "ghost-workspace-id"
        }
      ]
    };
    const corruptedSnapshot: RelationalBackupData = {
      app: "dashy",
      version: 2,
      exportedAt: new Date().toISOString(),
      checksum: computeBackupChecksum(corruptedData),
      data: corruptedData
    };

    const result = validateBackupForRestore(corruptedSnapshot);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Relational error: Task");
      expect(result.error).toContain("ghost-workspace-id");
    }
  });

  it("rejects backup with invalid schema structure", () => {
    const invalidPayload = {
      app: "dashy",
      version: 2,
      exportedAt: new Date().toISOString(),
      checksum: "abc",
      data: {
        // Missing required collections
        workspaces: []
      }
    };

    const result = validateBackupForRestore(invalidPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Invalid backup schema");
    }
  });
});
