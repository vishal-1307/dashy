import { describe, expect, it } from "vitest";
import {
  computeBackupChecksum,
  createBackupSnapshot,
  validateBackupForRestore,
  type RelationalBackupData
} from "../backup-engine";

describe("Relational Disaster Recovery & Backup Integrity Drill", () => {
  const sampleData: RelationalBackupData["data"] = {
    workspaces: [
      { id: "ws_freelance", slug: "freelance-software", name: "Freelance & Software Development" },
      { id: "ws_dkom", slug: "dkom", name: "DKOM" },
      { id: "ws_dj", slug: "diamond-jewellers", name: "Diamond Jewellers" },
      { id: "ws_ngo", slug: "mithila-kritikala", name: "Mithila KritiKala" },
      { id: "ws_personal", slug: "personal", name: "Personal" }
    ],
    tasks: [
      {
        id: "t_1",
        workspaceId: "ws_freelance",
        projectId: "p_1",
        title: "Build client payment ledger",
        status: "ACTIVE",
        priority: "HIGH",
        progress: 60,
        dueDate: "2026-10-25"
      },
      {
        id: "t_2",
        workspaceId: "ws_dkom",
        title: "Source organic mineral pigments",
        status: "DONE",
        priority: "MEDIUM",
        progress: 100,
        dueDate: "2026-10-14"
      }
    ],
    projects: [
      {
        id: "p_1",
        workspaceId: "ws_freelance",
        title: "Apex Retail Custom Software",
        status: "ACTIVE",
        priority: "URGENT",
        progress: 50,
        deadline: "2026-11-15"
      }
    ],
    clients: [
      {
        id: "c_1",
        workspaceId: "ws_freelance",
        name: "Rohit Sharma",
        company: "Apex Retail",
        dealValue: 75000,
        stage: "NEGOTIATION"
      }
    ],
    invoices: [
      {
        id: "inv_1",
        workspaceId: "ws_freelance",
        clientId: "c_1",
        invoiceNumber: "INV-2026-001",
        totalAmount: 75000,
        amountPaid: 35000,
        outstandingBalance: 40000,
        status: "PARTIALLY_PAID",
        dueAt: "2026-10-30"
      }
    ],
    financeTransactions: [
      {
        id: "tx_1",
        workspaceId: "ws_freelance",
        invoiceId: "inv_1",
        idempotencyKey: "tx_001_idemp",
        type: "INCOME",
        amount: 35000,
        category: "Advance Milestone"
      }
    ],
    notes: [
      {
        id: "n_1",
        workspaceId: "ws_freelance",
        title: "Architecture Specification",
        content: "API contracts and idempotency guarantees."
      }
    ],
    jobs: [
      {
        id: "j_1",
        company: "Stripe",
        role: "Senior Fullstack Engineer",
        status: "TECHNICAL"
      }
    ]
  };

  it("exports a complete relational backup snapshot with valid checksum", () => {
    const snapshot = createBackupSnapshot(sampleData);

    expect(snapshot.app).toBe("dashy");
    expect(snapshot.version).toBe(2);
    expect(snapshot.checksum).toHaveLength(64); // SHA-256 hex string
    expect(snapshot.data.workspaces).toHaveLength(5);
    expect(snapshot.data.tasks).toHaveLength(2);
    expect(snapshot.data.invoices).toHaveLength(1);
    expect(snapshot.data.financeTransactions).toHaveLength(1);
  });

  it("successfully validates and restores a valid backup with 100% relational integrity", () => {
    const snapshot = createBackupSnapshot(sampleData);
    const result = validateBackupForRestore(snapshot);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.backup.data.tasks[0]?.title).toBe("Build client payment ledger");
      expect(result.backup.data.invoices[0]?.outstandingBalance).toBe(40000);
      expect(result.backup.data.financeTransactions[0]?.amount).toBe(35000);
    }
  });

  it("rejects restoration if backup data was tampered or corrupted", () => {
    const snapshot = createBackupSnapshot(sampleData);

    // Tamper with data without updating checksum
    const tamperedSnapshot = {
      ...snapshot,
      data: {
        ...snapshot.data,
        invoices: [
          {
            ...snapshot.data.invoices[0]!,
            totalAmount: 999999 // Tampered amount
          }
        ]
      }
    };

    const result = validateBackupForRestore(tamperedSnapshot);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Integrity error: Backup checksum mismatch");
    }
  });

  it("rejects restoration if an entity violates foreign key workspace boundaries", () => {
    const snapshot = createBackupSnapshot(sampleData);

    // Task references non-existent workspace "ws_unknown"
    const orphanedData = {
      ...snapshot.data,
      tasks: [
        {
          ...snapshot.data.tasks[0]!,
          workspaceId: "ws_nonexistent_workspace"
        }
      ]
    };

    const orphanedSnapshot: RelationalBackupData = {
      ...snapshot,
      checksum: computeBackupChecksum(orphanedData),
      data: orphanedData
    };

    const result = validateBackupForRestore(orphanedSnapshot);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Relational error: Task");
      expect(result.error).toContain("references non-existent workspace");
    }
  });
});
