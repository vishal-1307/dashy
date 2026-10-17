"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building,
  Calendar,
  Mail,
  Phone,
  Plus,
  Users
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "../store";
import type { WorkspaceSlug } from "../types";
import { WORKSPACE_OPTIONS } from "./dashy-workspace";
import { cn } from "@/shared/lib/utils";

export type LeadStage =
  | "LEAD"
  | "CONTACTED"
  | "PROPOSAL_SENT"
  | "NEGOTIATION"
  | "WON"
  | "LOST";

export interface ClientLead {
  id: string;
  workspaceId: WorkspaceSlug;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  dealValue: number;
  stage: LeadStage;
  nextFollowUpAt?: string; // YYYY-MM-DD
  notes?: string;
  interactions: { id: string; type: string; summary: string; date: string }[];
}

const STAGES: { key: LeadStage; label: string; color: string }[] = [
  { key: "LEAD", label: "New Leads", color: "border-sky-500" },
  { key: "CONTACTED", label: "Contacted", color: "border-blue-500" },
  { key: "PROPOSAL_SENT", label: "Proposal Sent", color: "border-amber-500" },
  { key: "NEGOTIATION", label: "Negotiation", color: "border-purple-500" },
  { key: "WON", label: "Won Deals", color: "border-emerald-500" },
  { key: "LOST", label: "Closed / Lost", color: "border-stone-500" }
];

export function CrmView() {
  const store = useWorkspaceStore();
  const currentWs = store.activeWorkspace;
  const today = new Date().toISOString().slice(0, 10);

  const [clients, setClients] = useState<ClientLead[]>([
    {
      id: "cli_1",
      workspaceId: "freelance-software",
      name: "Rohit Sharma",
      company: "Apex Retail Solutions",
      email: "rohit@apexretail.in",
      phone: "+91 98765 43210",
      dealValue: 85000,
      stage: "NEGOTIATION",
      nextFollowUpAt: today,
      notes: "Requirements gathering done. Reviewing payment milestones proposal.",
      interactions: [
        { id: "int_1", type: "CALL", summary: "Discussed custom inventory dashboard", date: "2026-10-12" },
        { id: "int_2", type: "EMAIL", summary: "Sent revised quotation with 3 installments", date: "2026-10-15" }
      ]
    },
    {
      id: "cli_2",
      workspaceId: "dkom",
      name: "Pooja Verma",
      company: "Heritage Boutique",
      email: "pooja@heritageboutique.com",
      phone: "+91 91234 56789",
      dealValue: 35000,
      stage: "PROPOSAL_SENT",
      nextFollowUpAt: "2026-10-22",
      notes: "Wholesale inquiry for hand-painted Mithila jackets and dupattas.",
      interactions: [
        { id: "int_3", type: "WHATSAPP", summary: "Shared catalogue PDF and pricing tier", date: "2026-10-14" }
      ]
    },
    {
      id: "cli_3",
      workspaceId: "freelance-software",
      name: "Anil Singhal",
      company: "Singhal Logistics",
      email: "anil@singhallogistics.com",
      dealValue: 120000,
      stage: "WON",
      notes: "Full fleet management portal build. Advance payment received.",
      interactions: [
        { id: "int_4", type: "MEETING", summary: "Kickoff call and agreement signed", date: "2026-10-08" }
      ]
    }
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<ClientLead | null>(null);

  // New Lead form state
  const [newName, setNewName] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newDealValue, setNewDealValue] = useState("");
  const [newStage, setNewStage] = useState<LeadStage>("LEAD");
  const [newFollowUp, setNewFollowUp] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newWs, setNewWs] = useState<WorkspaceSlug>(currentWs === "unified" ? "freelance-software" : currentWs);

  // Interaction log form
  const [interactionType, setInteractionType] = useState("CALL");
  const [interactionSummary, setInteractionSummary] = useState("");

  const filteredClients = useMemo(() => {
    if (currentWs === "unified") return clients;
    return clients.filter((c) => c.workspaceId === currentWs);
  }, [clients, currentWs]);

  // Total pipeline value & follow-ups
  const totalPipelineValue = useMemo(() => {
    return filteredClients
      .filter((c) => c.stage !== "LOST")
      .reduce((sum, c) => sum + (c.dealValue || 0), 0);
  }, [filteredClients]);

  const urgentFollowUps = useMemo(() => {
    return filteredClients.filter(
      (c) => c.nextFollowUpAt && c.nextFollowUpAt <= today && c.stage !== "WON" && c.stage !== "LOST"
    );
  }, [filteredClients, today]);

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("Please enter client contact name");
      return;
    }
    const lead: ClientLead = {
      id: `cli_${Date.now()}`,
      workspaceId: newWs,
      name: newName.trim(),
      company: newCompany.trim() || undefined,
      email: newEmail.trim() || undefined,
      phone: newPhone.trim() || undefined,
      dealValue: parseFloat(newDealValue) || 0,
      stage: newStage,
      nextFollowUpAt: newFollowUp || undefined,
      notes: newNotes.trim() || undefined,
      interactions: []
    };
    setClients([lead, ...clients]);
    setShowAddModal(false);
    setNewName("");
    setNewCompany("");
    setNewEmail("");
    setNewPhone("");
    setNewDealValue("");
    setNewNotes("");
    toast.success(`Client ${lead.name} added to pipeline`);
  };

  const handleUpdateStage = (clientId: string, nextStage: LeadStage) => {
    setClients((prev) =>
      prev.map((c) => (c.id === clientId ? { ...c, stage: nextStage } : c))
    );
    toast.info(`Moved to ${nextStage}`);
  };

  const handleAddInteraction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient || !interactionSummary.trim()) return;
    const newInt = {
      id: `int_${Date.now()}`,
      type: interactionType,
      summary: interactionSummary.trim(),
      date: today
    };
    const updated = {
      ...selectedClient,
      interactions: [newInt, ...selectedClient.interactions]
    };
    setClients((prev) => prev.map((c) => (c.id === selectedClient.id ? updated : c)));
    setSelectedClient(updated);
    setInteractionSummary("");
    toast.success("Interaction logged");
  };

  return (
    <div className="crm-view">
      {/* Header */}
      <section className="module-header">
        <div className="module-header__icon"><Users /></div>
        <div>
          <p className="eyebrow">Client Relationship Management / Pipeline</p>
          <h1>Client CRM</h1>
          <p>Lead tracking, stage progression, deal values, and scheduled follow-up alerts.</p>
        </div>
        <button className="primary-button" onClick={() => setShowAddModal(true)}>
          <Plus /> New Lead
        </button>
      </section>

      {/* Metrics & Follow-up strip */}
      <section className="signal-strip" style={{ marginBottom: "1.5rem" }}>
        <div className="signal">
          <strong>{filteredClients.length}</strong>
          <span>Total Contacts</span>
          <small>across active pipeline</small>
        </div>
        <div className="signal">
          <strong style={{ color: "rgb(var(--accent))" }}>₹{totalPipelineValue.toLocaleString("en-IN")}</strong>
          <span>Pipeline Value</span>
          <small>active deals</small>
        </div>
        <div className="signal" style={{ borderLeft: urgentFollowUps.length ? "3px solid rgb(var(--danger))" : undefined }}>
          <strong style={{ color: urgentFollowUps.length ? "rgb(var(--danger))" : "rgb(var(--success))" }}>
            {urgentFollowUps.length}
          </strong>
          <span>Follow-ups Due</span>
          <small>{urgentFollowUps.length ? "attention needed today" : "all caught up"}</small>
        </div>
        <div className="signal">
          <strong style={{ color: "#10b981" }}>
            {filteredClients.filter((c) => c.stage === "WON").length}
          </strong>
          <span>Deals Won</span>
          <small>converted clients</small>
        </div>
      </section>

      {/* Follow-up Alert Banner */}
      {urgentFollowUps.length > 0 ? (
        <div
          style={{
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "var(--radius)",
            padding: "0.85rem 1.2rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.8rem"
          }}
        >
          <AlertTriangle style={{ color: "rgb(var(--danger))", width: "1.2rem", height: "1.2rem", flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: "0.82rem" }}>
            <strong>Action Required: {urgentFollowUps.length} follow-up{urgentFollowUps.length > 1 ? "s" : ""} scheduled for today:</strong>{" "}
            {urgentFollowUps.map((u) => `${u.name} (${u.company || "Direct"})`).join(", ")}
          </div>
        </div>
      ) : null}

      {/* Pipeline Kanban */}
      <div className="kanban-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
        {STAGES.map((col) => {
          const colClients = filteredClients.filter((c) => c.stage === col.key);
          const colValue = colClients.reduce((sum, c) => sum + (c.dealValue || 0), 0);
          return (
            <div key={col.key} className="kanban-col" style={{ minHeight: "22rem" }}>
              <div className="kanban-col__head" style={{ borderBottomColor: "rgb(var(--border))" }}>
                <div>
                  <h3 style={{ fontSize: "0.84rem" }}>{col.label}</h3>
                  <small style={{ fontSize: "0.68rem", color: "rgb(var(--muted))" }}>₹{colValue.toLocaleString("en-IN")}</small>
                </div>
                <span className="kanban-col__count">{colClients.length}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {colClients.map((client) => {
                  const ws = WORKSPACE_OPTIONS.find((w) => w.slug === client.workspaceId);
                  const isFollowUpDue = client.nextFollowUpAt && client.nextFollowUpAt <= today;
                  return (
                    <div
                      key={client.id}
                      className="item-card"
                      style={{ padding: "0.85rem", cursor: "pointer" }}
                      onClick={() => setSelectedClient(client)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.3rem" }}>
                        <strong style={{ fontSize: "0.88rem" }}>{client.name}</strong>
                        {ws ? (
                          <span className={cn("workspace-pill-badge", ws.dot)} style={{ fontSize: "0.58rem" }}>
                            {ws.label.split(" ")[0]}
                          </span>
                        ) : null}
                      </div>

                      {client.company ? (
                        <p style={{ fontSize: "0.74rem", color: "rgb(var(--muted))", display: "flex", alignItems: "center", gap: "0.3rem", margin: "0.2rem 0" }}>
                          <Building style={{ width: "0.75rem", height: "0.75rem" }} /> {client.company}
                        </p>
                      ) : null}

                      <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "rgb(var(--accent))", margin: "0.3rem 0" }}>
                        ₹{client.dealValue.toLocaleString("en-IN")}
                      </div>

                      {client.nextFollowUpAt ? (
                        <div
                          style={{
                            fontSize: "0.68rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            color: isFollowUpDue ? "rgb(var(--danger))" : "rgb(var(--muted))",
                            fontWeight: isFollowUpDue ? 700 : 500
                          }}
                        >
                          <Calendar style={{ width: "0.7rem", height: "0.7rem" }} />
                          Follow-up: {client.nextFollowUpAt}
                        </div>
                      ) : null}

                      <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.25rem" }} onClick={(e) => e.stopPropagation()}>
                        <select
                          value={client.stage}
                          onChange={(e) => handleUpdateStage(client.id, e.target.value as LeadStage)}
                          style={{ fontSize: "0.68rem", padding: "0.2rem 0.4rem", width: "100%", background: "rgb(var(--surface-strong))", border: "1px solid rgb(var(--border))", borderRadius: "var(--radius-sm)" }}
                        >
                          {STAGES.map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}

                {colClients.length === 0 ? (
                  <div style={{ padding: "1.2rem", textAlign: "center", color: "rgb(var(--muted))", fontSize: "0.72rem" }}>
                    No leads
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Client Modal */}
      {showAddModal ? (
        <div className="dialog-wrap" onMouseDown={() => setShowAddModal(false)}>
          <div className="capture-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Pipeline</p>
                <h2>Add Client Lead</h2>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddClient} style={{ display: "grid", gap: "0.8rem", marginTop: "1rem" }}>
              <div className="form-grid">
                <label>
                  Contact Name
                  <input autoFocus placeholder="e.g. Vikas Sharma" value={newName} onChange={(e) => setNewName(e.target.value)} required />
                </label>
                <label>
                  Company / Organization
                  <input placeholder="e.g. Singhal & Co" value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Email
                  <input type="email" placeholder="contact@example.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
                </label>
                <label>
                  Phone / WhatsApp
                  <input placeholder="+91 98765 43210" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Deal Value (₹)
                  <input type="number" placeholder="50000" value={newDealValue} onChange={(e) => setNewDealValue(e.target.value)} />
                </label>
                <label>
                  Initial Stage
                  <select value={newStage} onChange={(e) => setNewStage(e.target.value as LeadStage)}>
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-grid">
                <label>
                  Next Follow-Up Date
                  <input type="date" value={newFollowUp} onChange={(e) => setNewFollowUp(e.target.value)} />
                </label>
                <label>
                  Workspace
                  <select value={newWs} onChange={(e) => setNewWs(e.target.value as WorkspaceSlug)}>
                    {WORKSPACE_OPTIONS.filter((w) => w.slug !== "unified").map((w) => (
                      <option key={w.slug} value={w.slug}>{w.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Initial Notes / Requirements
                <textarea placeholder="e.g. Needs e-commerce catalog, payment gateway, timeline 3 weeks" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} />
              </label>

              <button className="primary-button primary-button--full" type="submit">
                <Plus /> Create Client Lead
              </button>
            </form>
          </div>
        </div>
      ) : null}

      {/* Client Detail Drawer / Modal */}
      {selectedClient ? (
        <div className="dialog-wrap" onMouseDown={() => setSelectedClient(null)}>
          <div className="capture-dialog" style={{ maxWidth: "34rem" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Client Profile</p>
                <h2>{selectedClient.name}</h2>
                <small style={{ color: "rgb(var(--muted))" }}>{selectedClient.company || "Individual Client"}</small>
              </div>
              <button className="icon-button" onClick={() => setSelectedClient(null)}>×</button>
            </div>

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.8rem" }}>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", fontSize: "0.8rem" }}>
                {selectedClient.email ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Mail style={{ width: "0.85rem", height: "0.85rem" }} /> {selectedClient.email}
                  </span>
                ) : null}
                {selectedClient.phone ? (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                    <Phone style={{ width: "0.85rem", height: "0.85rem" }} /> {selectedClient.phone}
                  </span>
                ) : null}
              </div>

              <div style={{ background: "rgb(var(--surface-strong))", padding: "0.75rem", borderRadius: "var(--radius)" }}>
                <div style={{ fontSize: "0.72rem", color: "rgb(var(--muted))", marginBottom: "0.2rem" }}>Deal Value:</div>
                <strong style={{ fontSize: "1rem", color: "rgb(var(--accent))" }}>₹{selectedClient.dealValue.toLocaleString("en-IN")}</strong>
                {selectedClient.notes ? (
                  <p style={{ fontSize: "0.76rem", margin: "0.4rem 0 0", color: "rgb(var(--foreground))" }}>
                    {selectedClient.notes}
                  </p>
                ) : null}
              </div>

              {/* Interaction History */}
              <div style={{ marginTop: "0.6rem" }}>
                <p style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem" }}>Interaction History</p>
                <form onSubmit={handleAddInteraction} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.8rem" }}>
                  <select
                    value={interactionType}
                    onChange={(e) => setInteractionType(e.target.value)}
                    style={{ fontSize: "0.72rem", padding: "0.25rem 0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid rgb(var(--border))" }}
                  >
                    <option value="CALL">Call</option>
                    <option value="EMAIL">Email</option>
                    <option value="MEETING">Meeting</option>
                    <option value="WHATSAPP">WhatsApp</option>
                  </select>
                  <input
                    placeholder="Log a call, email, or meeting note..."
                    value={interactionSummary}
                    onChange={(e) => setInteractionSummary(e.target.value)}
                    style={{ flex: 1, fontSize: "0.74rem", padding: "0.3rem 0.5rem", borderRadius: "var(--radius-sm)", border: "1px solid rgb(var(--border))" }}
                  />
                  <button type="submit" className="primary-button" style={{ padding: "0.25rem 0.6rem", fontSize: "0.72rem" }}>
                    Log
                  </button>
                </form>

                <div style={{ display: "grid", gap: "0.4rem", maxHeight: "12rem", overflowY: "auto" }}>
                  {selectedClient.interactions.map((int) => (
                    <div key={int.id} className="archive-row" style={{ padding: "0.45rem 0.7rem", fontSize: "0.74rem" }}>
                      <span style={{ fontWeight: 600, color: "rgb(var(--accent))", marginRight: "0.4rem" }}>[{int.type}]</span>
                      <span style={{ flex: 1 }}>{int.summary}</span>
                      <small style={{ color: "rgb(var(--muted))" }}>{int.date}</small>
                    </div>
                  ))}
                  {selectedClient.interactions.length === 0 ? (
                    <p style={{ fontSize: "0.72rem", color: "rgb(var(--muted))", textAlign: "center" }}>No interactions logged yet</p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
