"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  ExternalLink,
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
import {
  createDocument,
  deleteDocument as deleteDocumentAction,
  listDocuments,
  type DocumentCategory,
  type DocumentRecordItem
} from "@/server/actions/documents";
import { useWorkspaceStore } from "../store";
import type { WorkspaceSlug } from "../types";
import { WORKSPACE_OPTIONS } from "./dashy-workspace";
import { cn } from "@/shared/lib/utils";

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

  const [documents, setDocuments] = useState<DocumentRecordItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  // Form state
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState<DocumentCategory>("PROPOSAL");
  const [docWs, setDocWs] = useState<WorkspaceSlug>(currentWs === "unified" ? "freelance-software" : currentWs);
  const [docFileUrl, setDocFileUrl] = useState("");
  const [docContent, setDocContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listDocuments(currentWs)
      .then((data) => {
        if (active) {
          setDocuments(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to load documents:", err);
          toast.error("Could not load documents from database");
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [currentWs]);

  useEffect(() => {
    if (currentWs !== "unified") {
      setDocWs(currentWs);
    }
  }, [currentWs]);

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
        return (
          d.title.toLowerCase().includes(q) ||
          (d.content && d.content.toLowerCase().includes(q)) ||
          (d.fileUrl && d.fileUrl.toLowerCase().includes(q))
        );
      });
  }, [documents, currentWs, selectedCategory, searchQuery]);

  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docTitle.trim()) {
      toast.error("Please enter a document title");
      return;
    }

    setIsSubmitting(true);
    try {
      const contentBytes = docContent.trim() ? new TextEncoder().encode(docContent).length : 0;
      const computedSizeKb = contentBytes > 0 ? Math.max(1, Math.round(contentBytes / 1024)) : 0;

      const created = await createDocument({
        workspace: docWs,
        title: docTitle.trim(),
        category: docCategory,
        content: docContent.trim() || undefined,
        fileUrl: docFileUrl.trim() || undefined,
        sizeKb: computedSizeKb
      });

      setDocuments((prev) => [created, ...prev]);
      setShowAddModal(false);
      setDocTitle("");
      setDocFileUrl("");
      setDocContent("");
      toast.success(`Document record "${created.title}" saved to database`);
    } catch (err) {
      console.error("Create document error:", err);
      toast.error(err instanceof Error ? err.message : "Failed to create document");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDoc = async (id: string, title: string) => {
    if (!confirm(`Delete document record "${title}"?`)) return;

    const previous = documents;
    setDocuments((prev) => prev.filter((d) => d.id !== id));

    try {
      await deleteDocumentAction(id);
      toast.info("Document deleted from database");
    } catch (err) {
      console.error("Delete doc error:", err);
      setDocuments(previous);
      toast.error("Failed to delete document");
    }
  };

  return (
    <div className="documents-view">
      {/* Header */}
      <section className="module-header">
        <div className="module-header__icon"><FileText /></div>
        <div>
          <p className="eyebrow">Records & Contracts / Document Repository</p>
          <h1>Documents & Agreements</h1>
          <p>Database-backed repository for proposals, client agreements, scope documents, and authenticity certificates.</p>
        </div>
        <button className="primary-button" onClick={() => setShowAddModal(true)}>
          <Plus /> New Document
        </button>
      </section>

      {/* Scope Disclaimer */}
      <div
        style={{
          background: "rgb(var(--surface-strong))",
          border: "1px solid rgb(var(--border))",
          borderRadius: "var(--radius)",
          padding: "0.6rem 0.9rem",
          marginBottom: "1.2rem",
          fontSize: "0.76rem",
          color: "rgb(var(--muted))",
          lineHeight: 1.4
        }}
      >
        <strong>Document Repository Scope:</strong> Dashy records document metadata, markdown scopes/clauses, and external document links (e.g. Google Docs, Figma, Notion). Cloud binary file storage (S3/R2) is not connected in this MVP.
      </div>

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
      {loading ? (
        <div style={{ padding: "2rem", textAlign: "center", color: "rgb(var(--muted))" }}>
          Loading document repository from database...
        </div>
      ) : (
        <div className="item-grid">
          {filteredDocs.map((doc) => {
            const ws = WORKSPACE_OPTIONS.find((w) => w.slug === doc.workspaceId);
            const catInfo = CATEGORIES.find((c) => c.key === doc.category) || CATEGORIES[0];
            const Icon = catInfo.icon;
            const docKind = doc.fileUrl ? "External Link" : doc.content ? "Markdown Spec" : "Metadata Record";

            return (
              <div key={doc.id} className="item-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.5rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                      <Icon style={{ width: "1.2rem", height: "1.2rem", color: "rgb(var(--accent))" }} />
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: "999px", background: "rgb(var(--surface-strong))", color: "rgb(var(--accent))" }}>
                        {catInfo.label}
                      </span>
                      <span style={{ fontSize: "0.62rem", padding: "0.1rem 0.4rem", borderRadius: "var(--radius-sm)", border: "1px solid rgb(var(--border))", color: "rgb(var(--muted))" }}>
                        {docKind}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                      {ws ? (
                        <span className={cn("workspace-pill-badge", ws.dot)} style={{ fontSize: "0.55rem" }}>
                          {ws.label.split(" ")[0]}
                        </span>
                      ) : null}
                      <button type="button" className="icon-button" onClick={() => handleDeleteDoc(doc.id, doc.title)} title="Delete record">
                        <Trash2 style={{ width: "0.9rem", height: "0.9rem" }} />
                      </button>
                    </div>
                  </div>

                  <strong style={{ fontSize: "0.92rem", display: "block", marginBottom: "0.4rem" }}>
                    {doc.title}
                  </strong>

                  {doc.content ? (
                    <p style={{ fontSize: "0.78rem", color: "rgb(var(--muted))", lineHeight: 1.5, margin: "0.4rem 0" }}>
                      {doc.content}
                    </p>
                  ) : null}

                  {doc.fileUrl ? (
                    <div style={{ margin: "0.4rem 0", fontSize: "0.72rem", color: "rgb(var(--accent))", wordBreak: "break-all" }}>
                      🔗 {doc.fileUrl}
                    </div>
                  ) : null}
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgb(var(--border))", paddingTop: "0.6rem", marginTop: "0.8rem", fontSize: "0.7rem", color: "rgb(var(--muted))" }}>
                  <span>{doc.fileUrl ? "Linked doc" : `${doc.sizeKb} KB`} · {doc.createdAt}</span>
                  <div style={{ display: "flex", gap: "0.3rem" }}>
                    {doc.fileUrl ? (
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="secondary-button"
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.68rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                      >
                        <ExternalLink style={{ width: "0.75rem", height: "0.75rem" }} /> Open Link
                      </a>
                    ) : null}

                    {doc.content ? (
                      <button
                        type="button"
                        className="secondary-button"
                        style={{ padding: "0.2rem 0.5rem", fontSize: "0.68rem", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}
                        onClick={() => {
                          const blob = new Blob(
                            [`# ${doc.title}\n\nCategory: ${doc.category}\nDate: ${doc.createdAt}\n\n${doc.content}`],
                            { type: "text/markdown" }
                          );
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = `${doc.title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.md`;
                          a.click();
                          URL.revokeObjectURL(url);
                          toast.success(`Exported ${doc.title}.md`);
                        }}
                      >
                        <Download style={{ width: "0.75rem", height: "0.75rem" }} /> Export .md
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {filteredDocs.length === 0 ? (
            <div style={{ padding: "2rem", textAlign: "center", color: "rgb(var(--muted))", gridColumn: "1 / -1" }}>
              No document records found.
            </div>
          ) : null}
        </div>
      )}

      {/* Add Document Modal */}
      {showAddModal ? (
        <div className="dialog-wrap" onMouseDown={() => setShowAddModal(false)}>
          <div className="capture-dialog" onMouseDown={(e) => e.stopPropagation()}>
            <div className="drawer-head">
              <div>
                <p className="eyebrow">Repository</p>
                <h2>New Document Record</h2>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>×</button>
            </div>
            <form onSubmit={handleAddDocument} style={{ display: "grid", gap: "0.8rem", marginTop: "1rem" }}>
              <label>
                Document Title *
                <input autoFocus placeholder="e.g. Master Services Agreement" value={docTitle} onChange={(e) => setDocTitle(e.target.value)} required />
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
                External Document Link (Optional)
                <input
                  type="url"
                  placeholder="https://docs.google.com/... or Figma / Notion URL"
                  value={docFileUrl}
                  onChange={(e) => setDocFileUrl(e.target.value)}
                />
              </label>

              <label>
                Document Summary / Markdown Clauses
                <textarea
                  placeholder="e.g. Scope, key deliverables, IP clauses, payment terms..."
                  value={docContent}
                  onChange={(e) => setDocContent(e.target.value)}
                  rows={4}
                />
              </label>

              <p style={{ fontSize: "0.72rem", color: "rgb(var(--muted))", margin: 0 }}>
                Records metadata and markdown text in PostgreSQL. Binary file uploads to cloud buckets (S3/R2) are deferred.
              </p>

              <button className="primary-button primary-button--full" type="submit" disabled={isSubmitting}>
                <Plus /> {isSubmitting ? "Saving to database..." : "Create Document Record"}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
