import type {
  FinancialSummary,
  FinanceTransactionRecord,
  InvoiceRecord,
  InvoiceStatus
} from "./types";

/**
 * Derives the strict status and outstanding balance of an invoice.
 * Guaranteed invariants:
 * 1. An invoice is PAID if and only if outstandingBalance <= 0.
 * 2. If amountPaid > 0 and outstandingBalance > 0, status is PARTIALLY_PAID.
 * 3. Overdue state is captured based on dueAt comparison.
 */
export function deriveInvoiceStatus(
  totalAmount: number,
  amountPaid: number,
  dueAt: Date,
  now: Date = new Date()
): {
  status: InvoiceStatus;
  outstandingBalance: number;
  paidAt: Date | null;
  isOverdue: boolean;
} {
  if (totalAmount < 0) {
    throw new Error("Invoice totalAmount cannot be negative");
  }
  if (amountPaid < 0) {
    throw new Error("Invoice amountPaid cannot be negative");
  }

  const outstandingBalance = Math.max(0, totalAmount - amountPaid);
  const isPastDue = now.getTime() > dueAt.getTime();

  if (outstandingBalance === 0 && totalAmount > 0) {
    return {
      status: "PAID",
      outstandingBalance: 0,
      paidAt: now,
      isOverdue: false
    };
  }

  if (amountPaid > 0 && outstandingBalance > 0) {
    return {
      status: "PARTIALLY_PAID",
      outstandingBalance,
      paidAt: null,
      isOverdue: isPastDue
    };
  }

  if (isPastDue) {
    return {
      status: "OVERDUE",
      outstandingBalance,
      paidAt: null,
      isOverdue: true
    };
  }

  return {
    status: "SENT",
    outstandingBalance,
    paidAt: null,
    isOverdue: false
  };
}

/**
 * Validates whether an incoming payment amount can be safely applied to an invoice.
 */
export function validatePaymentApplication(
  invoice: InvoiceRecord,
  paymentAmount: number
): { valid: boolean; error?: string } {
  if (paymentAmount <= 0) {
    return { valid: false, error: "Payment amount must be greater than zero" };
  }
  if (invoice.status === "CANCELLED") {
    return { valid: false, error: "Cannot apply payment to a cancelled invoice" };
  }
  if (invoice.status === "PAID" || invoice.outstandingBalance <= 0) {
    return { valid: false, error: "Invoice is already fully paid" };
  }
  if (paymentAmount > invoice.outstandingBalance) {
    return {
      valid: false,
      error: `Payment amount (₹${paymentAmount}) exceeds outstanding balance (₹${invoice.outstandingBalance})`
    };
  }
  return { valid: true };
}

/**
 * Computes authoritative financial metrics:
 * Invoiced Revenue: Total billed across active (non-cancelled) invoices.
 * Collected Revenue: Total cash received across all INCOME transactions (invoice payments + standalone income).
 * Outstanding Balance: Uncollected balance across active invoices.
 * Expenses: Total across all EXPENSE transactions.
 * Net Profit: Collected Revenue - Expenses.
 */
export function calculateFinancialSummary(
  invoices: InvoiceRecord[],
  transactions: FinanceTransactionRecord[]
): FinancialSummary {
  const activeInvoices = invoices.filter((inv) => inv.status !== "CANCELLED");

  const invoicedRevenue = activeInvoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
  const outstandingBalance = activeInvoices.reduce((sum, inv) => sum + inv.outstandingBalance, 0);

  const collectedRevenue = transactions
    .filter((tx) => tx.type === "INCOME")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const expenses = transactions
    .filter((tx) => tx.type === "EXPENSE")
    .reduce((sum, tx) => sum + tx.amount, 0);

  const netProfit = collectedRevenue - expenses;

  return {
    invoicedRevenue,
    collectedRevenue,
    outstandingBalance,
    expenses,
    netProfit
  };
}

/**
 * Server-side idempotency handler:
 * Checks if a transaction with the same idempotencyKey already exists.
 * If yes, returns the existing record marked as replayed (preventing double submission/charges).
 * If no, executes the transaction factory and returns the newly created transaction.
 */
export async function executeIdempotentTransaction<T extends { idempotencyKey: string }>(
  existingRecord: T | null,
  creator: () => Promise<T>
): Promise<{ record: T; isDuplicate: boolean }> {
  if (existingRecord) {
    return { record: existingRecord, isDuplicate: true };
  }
  const created = await creator();
  return { record: created, isDuplicate: false };
}
