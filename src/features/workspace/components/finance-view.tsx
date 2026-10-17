"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Plus,
  Receipt,
  Target
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "../store";
import type { WorkspaceSlug } from "../types";
import { WORKSPACE_OPTIONS } from "./dashy-workspace";
import { deriveInvoiceStatus, validatePaymentApplication } from "@/server/finance/financial-ledger";
import type { FinanceTransactionRecord, InvoiceRecord } from "@/server/finance/types";
import { cn } from "@/shared/lib/utils";

const TARGET_GOAL_INR = 1_000_000;

export function FinanceView() {
  const store = useWorkspaceStore();
  const currentWs = store.activeWorkspace;

  // Local state for invoices & transactions (hydrated from store or state)
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([
    {
      id: "inv_1",
      userId: "owner",
      workspaceId: "freelance-software",
      clientId: "client_acme",
      invoiceNumber: "INV-2026-001",
      totalAmount: 75000,
      amountPaid: 35000,
      outstandingBalance: 40000,
      status: "PARTIALLY_PAID",
      dueAt: new Date("2026-10-25"),
      createdAt: new Date("2026-10-10")
    },
    {
      id: "inv_2",
      userId: "owner",
      workspaceId: "dkom",
      clientId: "client_mithila",
      invoiceNumber: "INV-2026-002",
      totalAmount: 25000,
      amountPaid: 25000,
      outstandingBalance: 0,
      status: "PAID",
      dueAt: new Date("2026-10-15"),
      paidAt: new Date("2026-10-14"),
      createdAt: new Date("2026-10-05")
    }
  ]);

  const [transactions, setTransactions] = useState<FinanceTransactionRecord[]>([
    {
      id: "tx_1",
      idempotencyKey: "tx_key_001",
      userId: "owner",
      workspaceId: "freelance-software",
      invoiceId: "inv_1",
      amount: 35000,
      type: "INCOME",
      category: "Web Dev Advance",
      transactedAt: new Date("2026-10-11"),
      createdAt: new Date("2026-10-11")
    },
    {
      id: "tx_2",
      idempotencyKey: "tx_key_002",
      userId: "owner",
      workspaceId: "dkom",
      invoiceId: "inv_2",
      amount: 25000,
      type: "INCOME",
      category: "Mithila Painting Commission",
      transactedAt: new Date("2026-10-14"),
      createdAt: new Date("2026-10-14")
    },
    {
      id: "tx_3",
      idempotencyKey: "tx_key_003",
      userId: "owner",
      workspaceId: "dkom",
      amount: 4500,
      type: "EXPENSE",
      category: "Fabric & Natural Colors",
      description: "Organic pigments and tussar silk fabric",
      transactedAt: new Date("2026-10-12"),
      createdAt: new Date("2026-10-12")
    }
  ]);

  const [goalMetric, setGoalMetric] = useState<"collected" | "profit">("collected");
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  // New Invoice form state
  const [invNum, setInvNum] = useState(`INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
  const [invClient, setInvClient] = useState("");
  const [invTotal, setInvTotal] = useState("");
  const [invDue, setInvDue] = useState(new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10));
  const [invWs, setInvWs] = useState<WorkspaceSlug>(currentWs === "unified" ? "freelance-software" : currentWs);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");

  // Expense form state
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("Hosting & Domains");
  const [expDesc, setExpDesc] = useState("");
  const [expWs, setExpWs] = useState<WorkspaceSlug>(currentWs === "unified" ? "freelance-software" : currentWs);

  // Filtered views by workspace
  const filteredInvoices = useMemo(() => {
    if (currentWs === "unified") return invoices;
    return invoices.filter((inv) => inv.workspaceId === currentWs);
  }, [invoices, currentWs]);

  const filteredTransactions = useMemo(() => {
    if (currentWs === "unified") return transactions;
    return transactions.filter((tx) => tx.workspaceId === currentWs);
  }, [transactions, currentWs]);

  // Financial calculations
  const invoicedRevenue = useMemo(() => {
    return filteredInvoices
      .filter((inv) => inv.status !== "CANCELLED")
      .reduce((sum, inv) => sum + inv.totalAmount, 0);
  }, [filteredInvoices]);

  const collectedRevenue = useMemo(() => {
    return filteredTransactions
      .filter((tx) => tx.type === "INCOME")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTransactions]);

  const outstandingBalance = useMemo(() => {
    return filteredInvoices
      .filter((inv) => inv.status !== "CANCELLED")
      .reduce((sum, inv) => sum + inv.outstandingBalance, 0);
  }, [filteredInvoices]);

  const expenses = useMemo(() => {
    return filteredTransactions
      .filter((tx) => tx.type === "EXPENSE")
      .reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredTransactions]);

  const netProfit = collectedRevenue - expenses;

  // ₹10,00,000 goal metric
  const goalCurrentValue = goalMetric === "collected" ? collectedRevenue : netProfit;
  const goalProgressPct = Math.min(100, Math.max(0, Math.round((goalCurrentValue / TARGET_GOAL_INR) * 100)));
  const goalRemaining = Math.max(0, TARGET_GOAL_INR - goalCurrentValue);

  const handleCreateInvoice = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(invTotal);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid invoice amount");
      return;
    }
    const newInv: InvoiceRecord = {
      id: `inv_${Date.now()}`,
      userId: "owner",
      workspaceId: invWs,
      clientId: invClient || "Client",
      invoiceNumber: invNum,
      totalAmount: amount,
      amountPaid: 0,
      outstandingBalance: amount,
      status: "SENT",
      dueAt: new Date(invDue),
      createdAt: new Date()
    };
    setInvoices([newInv, ...invoices]);
    setShowInvoiceModal(false);
    toast.success(`Invoice ${invNum} created successfully`);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amount = parseFloat(paymentAmount);
    const validation = validatePaymentApplication(selectedInvoice, amount);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    const idempotencyKey = `pay_${selectedInvoice.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newPaidTotal = selectedInvoice.amountPaid + amount;
    const statusUpdate = deriveInvoiceStatus(selectedInvoice.totalAmount, newPaidTotal, selectedInvoice.dueAt);

    // Update invoice atomically
    setInvoices((prev) =>
      prev.map((inv) =>
        inv.id === selectedInvoice.id
          ? {
              ...inv,
              amountPaid: newPaidTotal,
              outstandingBalance: statusUpdate.outstandingBalance,
              status: statusUpdate.status,
              paidAt: statusUpdate.paidAt
            }
          : inv
      )
    );

    // Append to transactions ledger
    const newTx: FinanceTransactionRecord = {
      id: `tx_${Date.now()}`,
      idempotencyKey,
      userId: "owner",
      workspaceId: selectedInvoice.workspaceId,
      invoiceId: selectedInvoice.id,
      amount,
      type: "INCOME",
      category: `Invoice Payment (${selectedInvoice.invoiceNumber})`,
      description: `Payment via ${paymentMethod}`,
      transactedAt: new Date(),
      createdAt: new Date()
    };
    setTransactions((prev) => [newTx, ...prev]);

    setShowPaymentModal(false);
    setSelectedInvoice(null);
    setPaymentAmount("");
    toast.success(`Payment of ₹${amount.toLocaleString("en-IN")} recorded successfully`);
  };

  const handleRecordExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid expense amount");
      return;
    }

    const idempotencyKey = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const newTx: FinanceTransactionRecord = {
      id: `tx_${Date.now()}`,
      idempotencyKey,
      userId: "owner",
      workspaceId: expWs,
      amount,
      type: "EXPENSE",
      category: expCategory,
      description: expDesc || undefined,
      transactedAt: new Date(),
      createdAt: new Date()
    };
    setTransactions((prev) => [newTx, ...prev]);

    setShowExpenseModal(false);
    setExpAmount("");
    setExpDesc("");
    toast.success(`Expense of ₹${amount.toLocaleString("en-IN")} recorded`);
  };

  return (
    <div className="finance-view">
      {/* Header */}
      <section className="module-header">
        <div className="module-header__icon"><CircleDollarSign /></div>
        <div>
          <p className="eyebrow">Financial Management / Invoicing & Ledger</p>
          <h1>Financial Overview</h1>
          <p>Multi-installment invoicing, cash receipts, operational expenses, and ₹10L goal progress.</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className="secondary-button" onClick={() => setShowExpenseModal(true)}>
            <ArrowDownRight /> Add Expense
          </button>
          <button className="primary-button" onClick={() => setShowInvoiceModal(true)}>
            <Plus /> New Invoice
          </button>
        </div>
      </section>

      {/* Metrics Strip */}
      <section className="signal-strip" style={{ marginBottom: "1.5rem" }}>
        <div className="signal">
          <strong>₹{invoicedRevenue.toLocaleString("en-IN")}</strong>
          <span>Invoiced Revenue</span>
          <small>total billed</small>
        </div>
        <div className="signal">
          <strong style={{ color: "rgb(var(--success))" }}>₹{collectedRevenue.toLocaleString("en-IN")}</strong>
          <span>Collected Revenue</span>
          <small>cash received</small>
        </div>
        <div className="signal">
          <strong style={{ color: outstandingBalance > 0 ? "rgb(var(--danger))" : undefined }}>
            ₹{outstandingBalance.toLocaleString("en-IN")}
          </strong>
          <span>Outstanding</span>
          <small>uncollected balances</small>
        </div>
        <div className="signal">
          <strong style={{ color: "#f97316" }}>₹{expenses.toLocaleString("en-IN")}</strong>
          <span>Expenses</span>
          <small>operational spend</small>
        </div>
        <div className="signal">
          <strong style={{ color: netProfit >= 0 ? "rgb(var(--accent))" : "rgb(var(--danger))" }}>
            ₹{netProfit.toLocaleString("en-IN")}
          </strong>
          <span>Calculated Net Profit</span>
          <small>collected - expenses</small>
        </div>
      </section>

      {/* ₹10,00,000 Earning Goal Widget */}
      <section className="settings-card" style={{ marginBottom: "2rem", borderLeft: "4px solid rgb(var(--accent))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Target style={{ color: "rgb(var(--accent))", width: "1.25rem", height: "1.25rem" }} />
              <h2 style={{ fontSize: "1.1rem", fontWeight: 700, margin: 0 }}>₹10,00,000 Milestone Target</h2>
            </div>
            <p style={{ color: "rgb(var(--muted))", fontSize: "0.8rem", margin: "0.3rem 0 0" }}>
              Tracking progress towards ₹10,00,000. Currently measuring: <strong>{goalMetric === "collected" ? "Collected Revenue" : "Calculated Net Profit"}</strong>
            </p>
          </div>
          <div className="segmented">
            <button
              type="button"
              className={cn("segmented__option", goalMetric === "collected" && "segmented__option--active")}
              onClick={() => setGoalMetric("collected")}
            >
              Collected (₹{collectedRevenue.toLocaleString("en-IN")})
            </button>
            <button
              type="button"
              className={cn("segmented__option", goalMetric === "profit" && "segmented__option--active")}
              onClick={() => setGoalMetric("profit")}
            >
              Net Profit (₹{netProfit.toLocaleString("en-IN")})
            </button>
          </div>
        </div>

        <div style={{ marginTop: "1.2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.4rem" }}>
            <span>₹{goalCurrentValue.toLocaleString("en-IN")} achieved ({goalProgressPct}%)</span>
            <span style={{ color: "rgb(var(--muted))" }}>Target: ₹10,00,000</span>
          </div>
          <div className="progress-line" style={{ height: "0.6rem", borderRadius: "999px" }}>
            <span style={{ width: `${goalProgressPct}%`, background: "linear-gradient(90deg, rgb(var(--accent)), #10b981)" }} />
          </div>
          <p style={{ fontSize: "0.74rem", color: "rgb(var(--muted))", marginTop: "0.5rem" }}>
            {goalRemaining === 0 ? "🎉 Milestone achieved! Incredible work!" : `₹${goalRemaining.toLocaleString("en-IN")} remaining to reach the ₹10L goal.`}
          </p>
        </div>
      </section>

      {/* Invoices List */}
      <section style={{ marginBottom: "2.5rem" }}>
        <div className="section-heading" style={{ marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow">Billing & Receivables</p>
            <h2>Invoices ({filteredInvoices.length})</h2>
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.8rem" }}>
          {filteredInvoices.map((inv) => {
            const isDueOver = new Date().getTime() > inv.dueAt.getTime() && inv.outstandingBalance > 0;
            const ws = WORKSPACE_OPTIONS.find((w) => w.slug === inv.workspaceId);
            return (
              <div key={inv.id} className="item-card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Receipt style={{ width: "1.1rem", height: "1.1rem", color: "rgb(var(--accent))" }} />
                    <strong style={{ fontSize: "0.95rem" }}>{inv.invoiceNumber}</strong>
                    {ws ? (
                      <span className={cn("workspace-pill-badge", ws.dot)}>{ws.label.split(" ")[0]}</span>
                    ) : null}
                    <span
                      style={{
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "0.15rem 0.5rem",
                        borderRadius: "999px",
                        background:
                          inv.status === "PAID"
                            ? "rgba(16, 185, 129, 0.15)"
                            : inv.status === "PARTIALLY_PAID"
                            ? "rgba(245, 158, 11, 0.15)"
                            : "rgba(99, 102, 241, 0.15)",
                        color:
                          inv.status === "PAID"
                            ? "#10b981"
                            : inv.status === "PARTIALLY_PAID"
                            ? "#f59e0b"
                            : "#6366f1"
                      }}
                    >
                      {isDueOver ? "OVERDUE / PARTIAL" : inv.status}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "rgb(var(--muted))", margin: "0.25rem 0 0" }}>
                    Client: {inv.clientId} · Due: {inv.dueAt.toLocaleDateString("en-IN")}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>₹{inv.totalAmount.toLocaleString("en-IN")}</div>
                    <div style={{ fontSize: "0.72rem", color: "rgb(var(--muted))" }}>
                      Paid: ₹{inv.amountPaid.toLocaleString("en-IN")} · Due: ₹{inv.outstandingBalance.toLocaleString("en-IN")}
                    </div>
                  </div>

                  {inv.outstandingBalance > 0 ? (
                    <button
                      className="secondary-button"
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.75rem" }}
                      onClick={() => {
                        setSelectedInvoice(inv);
                        setPaymentAmount(inv.outstandingBalance.toString());
                        setShowPaymentModal(true);
                      }}
                    >
                      <CreditCard style={{ width: "0.9rem", height: "0.9rem" }} /> Record Payment
                    </button>
                  ) : (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.3rem", color: "#10b981", fontSize: "0.78rem", fontWeight: 600 }}>
                      <CheckCircle2 style={{ width: "1rem", height: "1rem" }} /> Fully Paid
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Transaction History */}
      <section>
        <div className="section-heading" style={{ marginBottom: "1rem" }}>
          <div>
            <p className="eyebrow">Append-Only Ledger</p>
            <h2>Transactions & Cash Flows ({filteredTransactions.length})</h2>
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.5rem" }}>
          {filteredTransactions.map((tx) => {
            const isIncome = tx.type === "INCOME";
            return (
              <div
                key={tx.id}
                className="archive-row"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                  <div
                    style={{
                      width: "1.8rem",
                      height: "1.8rem",
                      borderRadius: "999px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: isIncome ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)",
                      color: isIncome ? "#10b981" : "#ef4444"
                    }}
                  >
                    {isIncome ? <ArrowUpRight style={{ width: "1rem", height: "1rem" }} /> : <ArrowDownRight style={{ width: "1rem", height: "1rem" }} />}
                  </div>
                  <div>
                    <strong style={{ fontSize: "0.82rem" }}>{tx.category}</strong>
                    <div style={{ fontSize: "0.7rem", color: "rgb(var(--muted))" }}>
                      {tx.description || tx.type} · {tx.transactedAt.toLocaleDateString("en-IN")}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: "0.9rem", fontWeight: 700, color: isIncome ? "#10b981" : "#ef4444" }}>
                  {isIncome ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN")}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* New Invoice Modal */}
      {showInvoiceModal ? (
        <div className="dialog-wrap" onMouseDown={() => setShowInvoiceModal(false)}>
          <div className="capture-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Billing</p>
                <h2>Create Invoice</h2>
              </div>
              <button className="icon-button" onClick={() => setShowInvoiceModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateInvoice} style={{ display: "grid", gap: "0.8rem", marginTop: "1rem" }}>
              <div className="form-grid">
                <label>
                  Invoice Number
                  <input value={invNum} onChange={(e) => setInvNum(e.target.value)} required />
                </label>
                <label>
                  Workspace
                  <select value={invWs} onChange={(e) => setInvWs(e.target.value as WorkspaceSlug)}>
                    {WORKSPACE_OPTIONS.filter((w) => w.slug !== "unified").map((w) => (
                      <option key={w.slug} value={w.slug}>{w.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Client Name
                <input placeholder="e.g. Acme Studio / Client Name" value={invClient} onChange={(e) => setInvClient(e.target.value)} required />
              </label>
              <div className="form-grid">
                <label>
                  Total Amount (₹)
                  <input type="number" placeholder="50000" value={invTotal} onChange={(e) => setInvTotal(e.target.value)} required />
                </label>
                <label>
                  Due Date
                  <input type="date" value={invDue} onChange={(e) => setInvDue(e.target.value)} required />
                </label>
              </div>
              <button className="primary-button primary-button--full" type="submit">
                <Receipt /> Generate Invoice
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Record Payment Modal */}
      {showPaymentModal && selectedInvoice ? (
        <div className="dialog-wrap" onMouseDown={() => setShowPaymentModal(false)}>
          <div className="capture-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Invoice: {selectedInvoice.invoiceNumber}</p>
                <h2>Record Payment</h2>
              </div>
              <button className="icon-button" onClick={() => setShowPaymentModal(false)}>×</button>
            </div>
            <form onSubmit={handleRecordPayment} style={{ display: "grid", gap: "0.8rem", marginTop: "1rem" }}>
              <p style={{ fontSize: "0.8rem", color: "rgb(var(--muted))" }}>
                Total: ₹{selectedInvoice.totalAmount.toLocaleString("en-IN")} · Outstanding Balance: <strong>₹{selectedInvoice.outstandingBalance.toLocaleString("en-IN")}</strong>
              </p>
              <label>
                Payment Amount (₹)
                <input
                  type="number"
                  max={selectedInvoice.outstandingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                />
              </label>
              <label>
                Payment Method
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  <option value="UPI">UPI</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                </select>
              </label>
              <button className="primary-button primary-button--full" type="submit">
                <CreditCard /> Apply Payment
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Record Expense Modal */}
      {showExpenseModal ? (
        <div className="dialog-wrap" onMouseDown={() => setShowExpenseModal(false)}>
          <div className="capture-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Outflows</p>
                <h2>Record Business Expense</h2>
              </div>
              <button className="icon-button" onClick={() => setShowExpenseModal(false)}>×</button>
            </div>
            <form onSubmit={handleRecordExpense} style={{ display: "grid", gap: "0.8rem", marginTop: "1rem" }}>
              <div className="form-grid">
                <label>
                  Amount (₹)
                  <input type="number" placeholder="2500" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} required />
                </label>
                <label>
                  Workspace
                  <select value={expWs} onChange={(e) => setExpWs(e.target.value as WorkspaceSlug)}>
                    {WORKSPACE_OPTIONS.filter((w) => w.slug !== "unified").map((w) => (
                      <option key={w.slug} value={w.slug}>{w.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Category
                <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                  <option value="Hosting & Domains">Hosting & Domains</option>
                  <option value="Software & Subscriptions">Software & Subscriptions</option>
                  <option value="Fabric & Colors">Fabric & Colors (DKOM)</option>
                  <option value="Jewellery Materials">Jewellery Materials</option>
                  <option value="NGO Training Supplies">NGO Training Supplies</option>
                  <option value="Books & Learning">Books & Learning</option>
                  <option value="Other Expenses">Other Expenses</option>
                </select>
              </label>
              <label>
                Description
                <input placeholder="e.g. Domain renewal, fabric order" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} />
              </label>
              <button className="primary-button primary-button--full" type="submit">
                <ArrowDownRight /> Record Expense
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
