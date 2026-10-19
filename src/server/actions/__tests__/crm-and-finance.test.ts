import { describe, expect, it, vi } from "vitest";

// Mock session
vi.mock("@/server/session", () => ({
  requireUserId: vi.fn().mockResolvedValue("user_owner_1")
}));

// Mock workspace helper
vi.mock("../workspace-helper", () => ({
  resolveWorkspaceId: vi.fn().mockResolvedValue("ws_freelance_1")
}));

import { createClient } from "../crm";
import { createInvoice, recordPayment } from "../finance";
import { prisma } from "@/server/db/client";

// Mock prisma
vi.mock("@/server/db/client", () => ({
  prisma: {
    client: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          workspace: { slug: "freelance-software" },
          interactions: []
        })
      )
    },
    invoice: {
      create: vi.fn().mockImplementation(({ data }) =>
        Promise.resolve({
          ...data,
          totalAmount: { toNumber: () => data.totalAmount },
          amountPaid: { toNumber: () => 0 },
          outstandingBalance: { toNumber: () => data.totalAmount },
          workspace: { slug: "freelance-software" },
          client: { name: "Acme Corp" }
        })
      ),
      findFirst: vi.fn()
    },
    financeTransaction: {
      findUnique: vi.fn(),
      create: vi.fn()
    },
    $transaction: vi.fn()
  }
}));

describe("CRM and Finance Server Actions: Validation & Safeguards", () => {
  it("validates client creation payload and rejects empty client name", async () => {
    await expect(
      createClient({
        workspace: "freelance-software",
        name: "", // Empty name must be rejected
        dealValue: 50000
      })
    ).rejects.toThrow("Client name is required");
  });

  it("validates client creation and rejects invalid email format", async () => {
    await expect(
      createClient({
        workspace: "freelance-software",
        name: "Test Client",
        email: "not-an-email"
      })
    ).rejects.toThrow("Invalid email");
  });

  it("validates client creation and rejects negative deal value", async () => {
    await expect(
      createClient({
        workspace: "freelance-software",
        name: "Test Client",
        dealValue: -500
      })
    ).rejects.toThrow();
  });

  it("creates client successfully with valid parameters", async () => {
    const client = await createClient({
      workspace: "freelance-software",
      name: "Acme Corporation",
      dealValue: 150000,
      stage: "PROPOSAL_SENT"
    });

    expect(client.name).toBe("Acme Corporation");
    expect(client.dealValue).toBe(150000);
    expect(client.stage).toBe("PROPOSAL_SENT");
    expect(client.workspaceId).toBe("freelance-software");
  });

  it("validates invoice creation and rejects zero or negative total amount", async () => {
    await expect(
      createInvoice({
        workspace: "freelance-software",
        invoiceNumber: "INV-001",
        totalAmount: 0,
        dueAt: "2026-11-01"
      })
    ).rejects.toThrow("greater than zero");
  });

  it("replays existing receipt when payment has duplicate idempotencyKey", async () => {
    const mockExistingTx = {
      id: "tx-existing-1",
      idempotencyKey: "dup-key-123",
      userId: "user_owner_1",
      amount: { toNumber: () => 30000 },
      type: "INCOME",
      category: "Invoice Payment",
      description: "Payment via UPI",
      occurredAt: new Date(),
      date: new Date(),
      createdAt: new Date(),
      workspace: { slug: "freelance-software" },
      invoice: {
        id: "inv-1",
        invoiceNumber: "INV-001",
        totalAmount: { toNumber: () => 100000 },
        amountPaid: { toNumber: () => 30000 },
        outstandingBalance: { toNumber: () => 70000 },
        status: "PARTIAL",
        dueAt: new Date(),
        paidAt: null,
        createdAt: new Date(),
        workspace: { slug: "freelance-software" },
        client: { name: "Acme Corp" }
      }
    };

    vi.mocked(prisma.financeTransaction.findUnique).mockResolvedValue(mockExistingTx as unknown as never);

    const result = await recordPayment({
      invoiceId: "inv-1",
      amount: 30000,
      paymentMethod: "UPI",
      idempotencyKey: "dup-key-123"
    });

    expect(result.isDuplicate).toBe(true);
    expect(result.transaction.id).toBe("tx-existing-1");
    expect(result.invoice.outstandingBalance).toBe(70000);
    // $transaction should not be called
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
