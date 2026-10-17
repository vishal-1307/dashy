"use client";

import { useMemo, useState } from "react";
import {
  Download,
  FileCheck,
  FileCode,
  FileSpreadsheet,
  FileText,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "../store";
import type { WorkspaceSlug } from "../types";
import { WORKSPACE_OPTIONS } from "./dashy-workspace";
import { cn } from "@/shared/lib/utils";

export type DocumentCategory =
  | "PROPOSAL"
  | "AGREEMENT"
  | "INVOICE"
  | "REQUIREMENT"
  | "TEMPLATE"
  | "OTHER";

export interface DocumentRecordItem {
  id: string;
  workspaceId: WorkspaceSlug;
  title: string;
  category: DocumentCategory;
  fileUrl?: string;
  fileKey?: string;
  mimeType?: string;
  sizeKb?: number;
  content?: string;
  createdAt: string;
}

const CATEGORIES: { key: DocumentCategory; label: string; icon: LucideIcon; color: string }[] = [
  { key: "PROPOSAL", label: "Proposals", icon: FileText, color: "text-blue-500" },
  { key: "AGREEMENT", label: "Agreements & Contracts", icon: FileCheck, color: "text-emerald-500" },
  { key: "INVOICE", label: "Invoices & Receipts", icon: FileSpreadsheet, color: "text-amber-500" },
  { key: "REQUIREMENT", label: "Requirements Specs", icon: FileCode, color: "text-purple-500" },
  { key: "TEMPLATE", label: "Legal & Work Templates", icon: FileText, color: "text-indigo-500" },
  { key: "OTHER", label: "Other Documents", icon: FileText, color: "text-stone-500" }
];

export function DocumentsView() {
  const store = useWorkspaceStore();
  const currentWs = store.activeWorkspace;

  const [documents, setDocuments] = useState<DocumentRecordItem[]>([
    {
      id: "doc_1",
      workspaceId: "freelance-software",
      title: "Master Software Development Agreement Template",
      category: "AGREEMENT",
      mimeType: "application/pdf",
      sizeKb: 142,
      content: "Standard IP transfer, payment milestones (40/30/30), confidentiality, and limitation of liability clauses.",
      createdAt: "2026-10-01"
    },
    {
      id: "doc_2",
      workspaceId: "freelance-software",
      title: "Technical Architecture & Security Scope: Apex Retail",
      category: "REQUIREMENT",
      mimeType: "text/markdown",
      sizeKb: 48,
      content: "Complete database ERD, RBAC permissions, and API rate limiting specification.",
      createdAt: "2026-10-12"
    },
    {
      id: "doc_3",
      workspaceId: "dkom",
      title: "DKOM Mithila Art Copyright & Authenticity Certificate",
      category: "TEMPLATE",
      mimeType: "application/pdf",
      sizeKb: 210,
      content: "Official signed certificate of authenticity accompanying each original Madhubani canvas and hand-painted silk kurta.",
      createdAt: "2026-10-06"
    },
    {
      id: "doc_4",
      workspaceId: "mithila-kritikala",
      title: "Mithila KritiKala Society Registration Deed & Bylaws",
      category: "AGREEMENT",
      mimeType: "application/pdf",
      sizeKb: 520,
      content: "Formal NGO registration certificates, trustee charter, and annual artisan training scheme.",
      createdAt: "2026-09-15"
    }
  ]);

  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState<DocumentCategory>("PROPOSAL");
  const [docWs, setDocWs] = useState<WorkspaceSlug>(currentWs === "unified" ? "freelance-software" : currentWs);
  const [docContent, setDocContent] = useState("");

  const filteredDocs = useMemo(() => {
    return documents
      .filter((d) => {
        if (currentWs === "unified") return true;
        return d.workspaceId === currentWs;
      })
      .filter((d) => (selectedCategory === "ALL" ? true : d.category === selectedCategory))
      .filter((d) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return d.title.toLowerCase().includes(q) || (d.content && d.content.toLowerCase().includes(q));
      });
  }, [documents, currentWs, selectedCategory, searchQuery]);

  const handleAddDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      toast.error("Please enter a document title");
      return;
    }
    const newDoc: DocumentRecordItem = {
      id: `doc_${Date.now()}`,
      workspaceId: docWs,
      title: docTitle.trim(),
      category: docCategory,
      sizeKb: Math.floor(20 + Math.random() * 200),
      content: docContent.trim() || undefined,
      createdAt: new Date().toISOString().slice(0, 10)
    };
    setDocuments([newDoc, ...documents]);
    setShowAddModal(false);
    setDocTitle("");
    setDocContent("");
    toast.success(`Document record "${newDoc.title}" created`);
  };

  const handleDeleteDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    toast.info("Document record deleted");
  };

  return (
    <div className="documents-view">
      {/* Header */}
      <section className="module-header">
        <div className="module-header__icon"><FileText /></div>
        <div>
          <p className="eyebrow">Records & Contracts / Document Repository</p>
          <h1>Documents & Agreements</h1>
          <p>Centralized storage for proposals, client agreements, scope documents, and authenticity certificates.</p>
        </div>
        <button className="primary-button" onClick={() => setShowAddModal(true)}>
          <Plus /> New Document
        </button>
      </section>

      {/* Filter and Search Bar */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgb(var(--surface-strong))", border: "1px solid rgb(var(--border))", borderRadius: "var(--radius)", padding: "0.4rem 0.75rem", flex: 1, minWidth: "15rem" }}>
          <Search style={{ width: "0.9rem", height: "0.9rem", color: "rgb(var(--muted))" }} />
          <input
            placeholder="Search document records, proposals, agreements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ background: "transparent", border: 0, fontSize: "0.82rem", width: "100%", color: "rgb(var(--foreground))" }}
          />
        </div>

        <div className="segmented">
          <button
            type="button"
            className={cn("segmented__option", selectedCategory === "ALL" && "segmented__option--active")}
            onClick={() => setSelectedCategory("ALL")}
          >
            All ({documents.length})
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              type="button"
              className={cn("segmented__option", selectedCategory === cat.key && "segmented__option--active")}
              onClick={() => setSelectedCategory(cat.key)}
            >
              {cat.label.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* Document Grid */}
      <div className="item-grid">
        {filteredDocs.map((doc) => {
          const ws = WORKSPACE_OPTIONS.find((w) => w.slug === doc.workspaceId);
          const catInfo = CATEGORIES.find((c) => c.key === doc.category) || CATEGORIES[0];
          const Icon = catInfo.icon;
          return (
            <div key={doc.id} className="item-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    <Icon style={{ width: "1.2rem", height: "1.2rem", color: "rgb(var(--accent))" }} />
                    <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "999px", background: "rgb(var(--surface-strong))", color: "rgb(var(--accent))" }}>
                      {catInfo.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                    {ws ? (
                      <span className={cn("workspace-pill-badge", ws.dot)} style={{ fontSize: "0.55rem" }}>
                        {ws.label.split(" ")[0]}
                      </span>
                    ) : null}
                    <button type="button" className="icon-button" onClick={() => handleDeleteDoc(doc.id)}>
                      <Trash2 style={{ width: "0.9rem", height: "0.9rem" }} />
                    </button>
                  </div>
                </div>

                <h3 style={{ fontSize: "0.95rem", fontWeight: 700, margin: "0.4rem 0" }}>{doc.title}</h3>

                {doc.content ? (
                  <p style={{ fontSize: "0.76rem", color: "rgb(var(--muted))", lineHeight: 1.5, margin: "0.4rem 0" }}>
                    {doc.content}
                  </p>
                ) : null}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgb(var(--border))", paddingTop: "0.6rem", marginTop: "0.8rem", fontSize: "0.7rem", color: "rgb(var(--muted))" }}>
                <span>{doc.sizeKb} KB · {doc.createdAt}</span>
                <span style={{ color: "rgb(var(--accent))", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem", cursor: "pointer" }} onClick={() => toast.success("Document downloaded")}>
                  <Download style={{ width: "0.8rem", height: "0.8rem" }} /> Download
                </span>
              </div>
            </div>
          );
        })}

        {filteredDocs.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", padding: "3rem", textAlign: "center", color: "rgb(var(--muted))" }}>
            No documents found matching this filter.
          </div>
        ) : null}
      </div>

      {/* Add Document Modal */}
      {showAddModal ? (
        <div className="dialog-wrap" onMouseDown={() => setShowAddModal(false)}>
          <div className="capture-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Repository</p>
                <h2>Add Document Record</h2>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddDocument} style={{ display: "grid", gap: "0.8rem", marginTop: "1rem" }}>
              <label>
                Document Title
                <input autoFocus placeholder="e.g. Master Services Agreement (MSA)" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} required />
              </label>

              <div className="form-grid">
                <label>
                  Category
                  <select value={docCategory} onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}>
                    {CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Workspace
                  <select value={docWs} onChange={(e) => setDocWs(e.target.value as WorkspaceSlug)}>
                    {WORKSPACE_OPTIONS.filter((w) => w.slug !== "unified").map((w) => (
                      <option key={w.slug} value={w.slug}>{w.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Document Summary / Terms
                <textarea placeholder="e.g. Scope of deliverables, payment milestones, signed date" value={docContent} onChange={(e) => setDocContent(e.target.value)} />
              </label>

              <button className="primary-button primary-button--full" type="submit">
                <Plus /> Create Document Record
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
