import { describe, expect, it, vi } from "vitest";
import {
  calculateFinancialSummary,
  deriveInvoiceStatus,
  executeIdempotentTransaction,
  validatePaymentApplication
} from "../financial-ledger";
import type { FinanceTransactionRecord, InvoiceRecord } from "../types";

describe("Financial Ledger: Invoice Status Derivation", () => {
  const futureDue = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const pastDue = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  it("marks invoice as PAID when amountPaid equals totalAmount", () => {
    const result = deriveInvoiceStatus(50000, 50000, futureDue);
    expect(result.status).toBe("PAID");
    expect(result.outstandingBalance).toBe(0);
    expect(result.paidAt).toBeInstanceOf(Date);
    expect(result.isOverdue).toBe(false);
  });

  it("marks invoice as PARTIALLY_PAID when partial payment is recorded", () => {
    const result = deriveInvoiceStatus(50000, 20000, futureDue);
    expect(result.status).toBe("PARTIALLY_PAID");
    expect(result.outstandingBalance).toBe(30000);
    expect(result.paidAt).toBeNull();
    expect(result.isOverdue).toBe(false);
  });

  it("captures overdue status on partially paid invoice when past due", () => {
    const result = deriveInvoiceStatus(50000, 20000, pastDue);
    expect(result.status).toBe("PARTIALLY_PAID");
    expect(result.outstandingBalance).toBe(30000);
    expect(result.isOverdue).toBe(true);
  });

  it("marks invoice as OVERDUE when zero payment and past due", () => {
    const result = deriveInvoiceStatus(50000, 0, pastDue);
    expect(result.status).toBe("OVERDUE");
    expect(result.outstandingBalance).toBe(50000);
    expect(result.isOverdue).toBe(true);
  });

  it("rejects negative totals or payments", () => {
    expect(() => deriveInvoiceStatus(-100, 0, futureDue)).toThrow();
    expect(() => deriveInvoiceStatus(100, -10, futureDue)).toThrow();
  });
});

describe("Financial Ledger: Payment Validation", () => {
  const baseInvoice: InvoiceRecord = {
    id: "inv-1",
    userId: "user-1",
    workspaceId: "ws-freelance",
    invoiceNumber: "INV-2026-001",
    totalAmount: 100000,
    amountPaid: 30000,
    outstandingBalance: 70000,
    status: "PARTIALLY_PAID",
    dueAt: new Date(Date.now() + 86400000),
    createdAt: new Date()
  };

  it("allows valid installment up to outstanding balance", () => {
    const check1 = validatePaymentApplication(baseInvoice, 35000);
    expect(check1.valid).toBe(true);

    const check2 = validatePaymentApplication(baseInvoice, 70000);
    expect(check2.valid).toBe(true);
  });

  it("rejects payments that exceed the outstanding balance", () => {
    const check = validatePaymentApplication(baseInvoice, 70001);
    expect(check.valid).toBe(false);
    expect(check.error).toContain("exceeds outstanding balance");
  });

  it("rejects payments with zero or negative amounts", () => {
    expect(validatePaymentApplication(baseInvoice, 0).valid).toBe(false);
    expect(validatePaymentApplication(baseInvoice, -500).valid).toBe(false);
  });

  it("rejects payments to cancelled invoices", () => {
    const cancelled: InvoiceRecord = { ...baseInvoice, status: "CANCELLED" };
    const check = validatePaymentApplication(cancelled, 10000);
    expect(check.valid).toBe(false);
    expect(check.error).toContain("cancelled");
  });

  it("rejects payments to fully paid invoices", () => {
    const paid: InvoiceRecord = {
      ...baseInvoice,
      amountPaid: 100000,
      outstandingBalance: 0,
      status: "PAID"
    };
    const check = validatePaymentApplication(paid, 1000);
    expect(check.valid).toBe(false);
    expect(check.error).toContain("already fully paid");
  });
});

describe("Financial Ledger: Metrics and Anti-Double-Counting", () => {
  it("strictly separates invoiced, collected, expenses, and net profit", () => {
    const invoices: InvoiceRecord[] = [
      {
        id: "inv-1",
        userId: "user-1",
        workspaceId: "ws-freelance",
        invoiceNumber: "INV-001",
        totalAmount: 100000,
        amountPaid: 40000,
        outstandingBalance: 60000,
        status: "PARTIALLY_PAID",
        dueAt: new Date(),
        createdAt: new Date()
      },
      {
        id: "inv-2",
        userId: "user-1",
        workspaceId: "ws-freelance",
        invoiceNumber: "INV-002",
        totalAmount: 50000,
        amountPaid: 0,
        outstandingBalance: 50000,
        status: "SENT",
        dueAt: new Date(),
        createdAt: new Date()
      },
      {
        id: "inv-3",
        userId: "user-1",
        workspaceId: "ws-freelance",
        invoiceNumber: "INV-003",
        totalAmount: 30000,
        amountPaid: 0,
        outstandingBalance: 30000,
        status: "CANCELLED",
        dueAt: new Date(),
        createdAt: new Date()
      }
    ];

    const transactions: FinanceTransactionRecord[] = [
      // Payment 1 for invoice 1 (advance)
      {
        id: "tx-1",
        idempotencyKey: "idem-1",
        userId: "user-1",
        workspaceId: "ws-freelance",
        invoiceId: "inv-1",
        amount: 40000,
        type: "INCOME",
        category: "Client Payment",
        transactedAt: new Date(),
        createdAt: new Date()
      },
      // Standalone direct cash sale (e.g. DKOM art sale, no invoice)
      {
        id: "tx-2",
        idempotencyKey: "idem-2",
        userId: "user-1",
        workspaceId: "ws-dkom",
        invoiceId: null,
        amount: 15000,
        type: "INCOME",
        category: "Art Sale",
        transactedAt: new Date(),
        createdAt: new Date()
      },
      // Expense (e.g. art supplies)
      {
        id: "tx-3",
        idempotencyKey: "idem-3",
        userId: "user-1",
        workspaceId: "ws-dkom",
        amount: 8000,
        type: "EXPENSE",
        category: "Supplies",
        transactedAt: new Date(),
        createdAt: new Date()
      }
    ];

    const summary = calculateFinancialSummary(invoices, transactions);

    // Invoiced revenue excludes cancelled invoice (100k + 50k = 150k)
    expect(summary.invoicedRevenue).toBe(150000);

    // Collected revenue is actual cash received: 40k (inv-1) + 15k (art sale) = 55k
    // Notice: unpaid 50k on inv-2 is NOT in collected revenue!
    expect(summary.collectedRevenue).toBe(55000);

    // Outstanding balance on active invoices: 60k + 50k = 110k
    expect(summary.outstandingBalance).toBe(110000);

    // Expenses: 8k
    expect(summary.expenses).toBe(8000);

    // Net profit = 55k collected - 8k expense = 47k
    expect(summary.netProfit).toBe(47000);
  });
});

describe("Financial Ledger: Server-Side Idempotency Protection", () => {
  it("prevents double-submission on identical idempotencyKey", async () => {
    const existingTx: FinanceTransactionRecord = {
      id: "tx-saved-1",
      idempotencyKey: "client-req-uuid-12345",
      userId: "user-1",
      workspaceId: "ws-freelance",
      amount: 25000,
      type: "INCOME",
      category: "Invoice Payment",
      transactedAt: new Date(),
      createdAt: new Date()
    };

    const creatorSpy = vi.fn().mockResolvedValue({
      id: "tx-new-should-not-exist",
      idempotencyKey: "client-req-uuid-12345",
      amount: 25000
    });

    // Simulating user double-clicking "Pay" button or network retry
    const result = await executeIdempotentTransaction(existingTx, creatorSpy);

    expect(result.isDuplicate).toBe(true);
    expect(result.record.id).toBe("tx-saved-1");
    // Verify database creation function was NOT called again
    expect(creatorSpy).not.toHaveBeenCalled();
  });

  it("creates transaction normally when idempotencyKey is new", async () => {
    const newTx: FinanceTransactionRecord = {
      id: "tx-new-1",
      idempotencyKey: "client-fresh-uuid-99999",
      userId: "user-1",
      workspaceId: "ws-freelance",
      amount: 10000,
      type: "INCOME",
      category: "Deposit",
      transactedAt: new Date(),
      createdAt: new Date()
    };

    const creatorSpy = vi.fn().mockResolvedValue(newTx);

    const result = await executeIdempotentTransaction<FinanceTransactionRecord>(null, creatorSpy);

    expect(result.isDuplicate).toBe(false);
    expect(result.record.id).toBe("tx-new-1");
    expect(creatorSpy).toHaveBeenCalledOnce();
  });
});
