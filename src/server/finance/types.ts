export type TransactionType = "INCOME" | "EXPENSE";

export type InvoiceStatus =
  | "DRAFT"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface FinanceTransactionRecord {
  id: string;
  idempotencyKey: string;
  userId: string;
  workspaceId: string;
  invoiceId?: string | null;
  amount: number;
  type: TransactionType;
  category: string;
  description?: string | null;
  transactedAt: Date;
  createdAt: Date;
}

export interface InvoiceRecord {
  id: string;
  userId: string;
  workspaceId: string;
  clientId?: string | null;
  invoiceNumber: string;
  totalAmount: number;
  amountPaid: number;
  outstandingBalance: number;
  status: InvoiceStatus;
  dueAt: Date;
  paidAt?: Date | null;
  createdAt: Date;
}

export interface FinancialSummary {
  invoicedRevenue: number;
  collectedRevenue: number;
  outstandingBalance: number;
  expenses: number;
  netProfit: number;
}
