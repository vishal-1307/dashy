"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  createInvoice,
  listInvoices,
  listTransactions,
  recordExpense,
  recordPayment
} from "@/server/actions/finance";
import type { FinanceTransactionRecord, InvoiceRecord } from "@/server/finance/types";
import { useWorkspaceStore } from "../store";
import type { WorkspaceSlug } from "../types";
import { WORKSPACE_OPTIONS } from "./dashy-workspace";
import { cn } from "@/shared/lib/utils";

const TARGET_GOAL_INR = 1_000_000;

export function FinanceView() {
  const store = useWorkspaceStore();
  const currentWs = store.activeWorkspace;

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransactionRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [isSubmittingInv, setIsSubmittingInv] = useState(false);

  // Payment form state
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("UPI");
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Expense form state
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("Hosting & Domains");
  const [expDesc, setExpDesc] = useState("");
  const [expWs, setExpWs] = useState<WorkspaceSlug>(currentWs === "unified" ? "freelance-software" : currentWs);
  const [isSubmittingExp, setIsSubmittingExp] = useState(false);

  // Fetch real data from DB
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([listInvoices(currentWs), listTransactions(currentWs)])
      .then(([invs, txs]) => {
        if (active) {
          setInvoices(invs);
          setTransactions(txs);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load finance data:", err);
          toast.error("Could not load financial records from database");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentWs]);

  // Keep workspace inputs synced when current workspace changes
  useEffect(() => {
    if (currentWs !== "unified") {
      setInvWs(currentWs);
      setExpWs(currentWs);
    }
  }, [currentWs]);

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

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(invTotal);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid invoice amount");
      return;
    }

    setIsSubmittingInv(true);
    try {
      const created = await createInvoice({
        workspace: invWs,
        invoiceNumber: invNum.trim(),
        clientName: invClient.trim() || undefined,
        totalAmount: amount,
        dueAt: invDue
      });

      setInvoices((prev) => [created, ...prev]);
      setShowInvoiceModal(false);
      setInvNum(`INV-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`);
      setInvClient("");
      setInvTotal("");
      toast.success(`Invoice ${created.invoiceNumber} saved to database`);
    } catch (err) {
      console.error("Create invoice error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create invoice");
    } finally {
      setIsSubmittingInv(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    const amount = parseFloat(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    const idempotencyKey = `pay_${selectedInvoice.id}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    setIsSubmittingPay(true);
    try {
      const result = await recordPayment({
        invoiceId: selectedInvoice.id,
        amount,
        paymentMethod,
        idempotencyKey
      });

      // Update local invoice state
      setInvoices((prev) =>
        prev.map((inv) => (inv.id === selectedInvoice.id ? result.invoice : inv))
      );

      // Prepend to transactions if not duplicate
      if (!result.isDuplicate) {
        setTransactions((prev) => [result.transaction, ...prev]);
      }

      setShowPaymentModal(false);
      setSelectedInvoice(null);
      setPaymentAmount("");
      toast.success(
        result.isDuplicate
          ? `Duplicate payment detected — replayed safely.`
          : `Payment of ₹${amount.toLocaleString("en-IN")} recorded to ledger`
      );
    } catch (err) {
      console.error("Record payment error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(expAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter a valid expense amount");
      return;
    }

    const idempotencyKey = `exp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    setIsSubmittingExp(true);
    try {
      const result = await recordExpense({
        workspace: expWs,
        amount,
        category: expCategory,
        description: expDesc || undefined,
        idempotencyKey
      });

      if (!result.isDuplicate) {
        setTransactions((prev) => [result.transaction, ...prev]);
      }

      setShowExpenseModal(false);
      setExpAmount("");
      setExpDesc("");
      toast.success(
        result.isDuplicate
          ? `Duplicate expense detected — replayed safely.`
          : `Expense of ₹${amount.toLocaleString("en-IN")} recorded`
      );
    } catch (err) {
      console.error("Record expense error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to record expense");
    } finally {
      setIsSubmittingExp(false);
    }
  };

  return (
    <div className="finance-view">
      {/* Header */}
      <section className="module-header">
        <div className="module-header__icon"><CircleDollarSign /></div>
        <div>
          <p className="eyebrow">Financial Management / Invoicing & Ledger</p>
          <h1>Financial Overview</h1>
          <p>Database-backed invoicing, append-only cash flows, idempotent payments, and ₹10L goal progress.</p>
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

      {/* Loading state indicator */}
      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "rgb(var(--muted))" }}>
          Loading financial ledger from database...
        </div>
      ) : (
        <>
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
                const dueDateObj = new Date(inv.dueAt);
                const isDueOver = new Date().getTime() > dueDateObj.getTime() && inv.outstandingBalance > 0;
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
                        Client: {inv.clientId} · Due: {dueDateObj.toLocaleDateString("en-IN")}
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

              {filteredInvoices.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "rgb(var(--muted))", fontSize: "0.8rem" }}>
                  No invoices created yet. Click &quot;New Invoice&quot; to create one.
                </div>
              ) : null}
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
                const txDate = new Date(tx.transactedAt);
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
                          {tx.description || tx.type} · {txDate.toLocaleDateString("en-IN")}
                        </div>
                      </div>
                    </div>

                    <div style={{ fontSize: "0.9rem", fontWeight: 700, color: isIncome ? "#10b981" : "#ef4444" }}>
                      {isIncome ? "+" : "-"}₹{tx.amount.toLocaleString("en-IN")}
                    </div>
                  </div>
                );
              })}

              {filteredTransactions.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", color: "rgb(var(--muted))", fontSize: "0.8rem" }}>
                  No transactions recorded yet.
                </div>
              ) : null}
            </div>
          </section>
        </>
      )}

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
                  Invoice Number *
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
                <input placeholder="e.g. Acme Studio / Client Name" value={invClient} onChange={(e) => setInvClient(e.target.value)} />
              </label>
              <div className="form-grid">
                <label>
                  Total Amount (₹) *
                  <input type="number" placeholder="50000" value={invTotal} onChange={(e) => setInvTotal(e.target.value)} required />
                </label>
                <label>
                  Due Date *
                  <input type="date" value={invDue} onChange={(e) => setInvDue(e.target.value)} required />
                </label>
              </div>
              <button className="primary-button primary-button--full" type="submit" disabled={isSubmittingInv}>
                <Receipt /> {isSubmittingInv ? "Generating Invoice..." : "Generate Invoice"}
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
                Payment Amount (₹) *
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
              <button className="primary-button primary-button--full" type="submit" disabled={isSubmittingPay}>
                <CreditCard /> {isSubmittingPay ? "Applying Payment..." : "Apply Payment"}
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
                  Amount (₹) *
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
              <button className="primary-button primary-button--full" type="submit" disabled={isSubmittingExp}>
                <ArrowDownRight /> {isSubmittingExp ? "Recording Expense..." : "Record Expense"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
