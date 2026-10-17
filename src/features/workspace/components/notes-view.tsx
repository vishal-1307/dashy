"use client";

import { useMemo, useState } from "react";
import {
  Edit3,
  Eye,
  Folder,
  NotebookTabs,
  Pin,
  Plus,
  Search,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceStore } from "../store";
import type { WorkspaceSlug } from "../types";
import { WORKSPACE_OPTIONS } from "./dashy-workspace";
import { cn } from "@/shared/lib/utils";

export interface NoteItem {
  id: string;
  workspaceId: WorkspaceSlug;
  folderId?: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteFolderItem {
  id: string;
  workspaceId: WorkspaceSlug;
  name: string;
}

export function NotesView() {
  const store = useWorkspaceStore();
  const currentWs = store.activeWorkspace;

  const [folders, setFolders] = useState<NoteFolderItem[]>([
    { id: "f_tech", workspaceId: "freelance-software", name: "Client Architecture Specs" },
    { id: "f_dkom", workspaceId: "dkom", name: "Product Catalogue & Motifs" },
    { id: "f_dj", workspaceId: "diamond-jewellers", name: "Jewellery Inventory & Web" },
    { id: "f_ngo", workspaceId: "mithila-kritikala", name: "Artisan Training & Grants" },
    { id: "f_personal", workspaceId: "personal", name: "Cybersecurity & College Notes" }
  ]);

  const [notes, setNotes] = useState<NoteItem[]>([
    {
      id: "n_1",
      workspaceId: "freelance-software",
      folderId: "f_tech",
      title: "API Architecture: High-Performance Next.js 15 & Neon",
      content: `# API Architecture & Data Contracts

## Overview
This document specifies the architectural patterns used for high-reliability client projects.

### Core Tenets
- **Server Actions with UUIDs:** Never allow client-provided primary keys.
- **Strict Idempotency:** Append-only ledger transactions using \`idempotencyKey\`.
- **Relational Integrity:** Cascading deletes and explicit foreign key checks.

\`\`\`typescript
export async function requireOwnerSession() {
  const session = await auth.api.getSession();
  assert(session.user.email === OWNER_EMAIL);
}
\`\`\`

### Next Milestones
- [x] Schema verification & vitest coverage
- [x] Multi-installment invoice ledger
- [ ] Automated weekly backup drill`,
      tags: ["architecture", "nextjs", "database"],
      isPinned: true,
      createdAt: "2026-10-14",
      updatedAt: "2026-10-17"
    },
    {
      id: "n_2",
      workspaceId: "dkom",
      folderId: "f_dkom",
      title: "DKOM Spring Collection: Madhubani Fish & Peacock Motifs",
      content: `# DKOM Hand-Painted Apparel Specifications

## Heritage Concept
Integrating classic *Kachni* (line work) and *Bharni* (color filling) techniques on tussar silk kurtas and dupattas.

### Primary Color Palette
- **Deep Madder Red:** Extracted from organic pigments
- **Turmeric Ochre:** Natural yellow wash
- **Lampblack:** Pure border lining and geometric fill

### Fabric Requirements
- 40 meters pure handloom Bhagalpuri tussar silk
- Pre-washing in cold alum solution to fix colors`,
      tags: ["mithila-art", "fashion", "dkom"],
      isPinned: true,
      createdAt: "2026-10-10",
      updatedAt: "2026-10-16"
    },
    {
      id: "n_3",
      workspaceId: "personal",
      folderId: "f_personal",
      title: "Active Directory Security & Kerberoasting Notes",
      content: `# Active Directory Attack Vectors & Defense

## Kerberoasting Mechanics
1. Request service ticket (TGS) for SPN account.
2. Extract encrypted ticket response from memory.
3. Offline hash cracking using hashcat / john.

### Remediation
- Enforce AES encryption over RC4.
- Use Managed Service Accounts (gMSAs) with 128-character auto-rotated passwords.`,
      tags: ["cybersecurity", "active-directory", "pentesting"],
      isPinned: false,
      createdAt: "2026-10-05",
      updatedAt: "2026-10-15"
    }
  ]);

  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNoteId, setActiveNoteId] = useState<string>(notes[0]?.id || "");
  const [previewMode, setPreviewMode] = useState<"edit" | "preview" | "split">("split");
  const [newFolderInput, setNewFolderInput] = useState("");
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Filter notes by workspace, folder, tag, search
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        if (currentWs === "unified") return true;
        return n.workspaceId === currentWs;
      })
      .filter((n) => (!selectedFolder ? true : n.folderId === selectedFolder))
      .filter((n) => (!selectedTag ? true : n.tags.includes(selectedTag)))
      .filter((n) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      })
      .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
  }, [notes, currentWs, selectedFolder, selectedTag, searchQuery]);

  const activeNote = notes.find((n) => n.id === activeNoteId) || filteredNotes[0] || null;

  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach((n) => n.tags.forEach((t) => set.add(t)));
    return Array.from(set);
  }, [notes]);

  const handleCreateNote = () => {
    const ws = currentWs === "unified" ? "freelance-software" : currentWs;
    const newNote: NoteItem = {
      id: `n_${Date.now()}`,
      workspaceId: ws,
      folderId: selectedFolder || undefined,
      title: "Untitled Note",
      content: `# Untitled Note\n\nWrite your thoughts, docs, or plans here...`,
      tags: [],
      isPinned: false,
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString().slice(0, 10)
    };
    setNotes([newNote, ...notes]);
    setActiveNoteId(newNote.id);
    toast.success("New note created");
  };

  const handleUpdateActiveNote = (updates: Partial<NoteItem>) => {
    if (!activeNote) return;
    setNotes((prev) =>
      prev.map((n) => (n.id === activeNote.id ? { ...n, ...updates, updatedAt: new Date().toISOString().slice(0, 10) } : n))
    );
  };

  const handleDeleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.info("Note deleted");
  };

  const handleAddFolder = () => {
    if (!newFolderInput.trim()) return;
    const ws = currentWs === "unified" ? "freelance-software" : currentWs;
    const folder: NoteFolderItem = {
      id: `f_${Date.now()}`,
      workspaceId: ws,
      name: newFolderInput.trim()
    };
    setFolders([...folders, folder]);
    setNewFolderInput("");
    setShowNewFolder(false);
    toast.success(`Folder "${folder.name}" added`);
  };

  // Basic markdown preview renderer
  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      if (line.startsWith("# ")) {
        return <h1 key={idx} style={{ fontSize: "1.4rem", fontWeight: 800, margin: "1rem 0 0.5rem" }}>{line.slice(2)}</h1>;
      }
      if (line.startsWith("## ")) {
        return <h2 key={idx} style={{ fontSize: "1.15rem", fontWeight: 700, margin: "0.8rem 0 0.4rem" }}>{line.slice(3)}</h2>;
      }
      if (line.startsWith("### ")) {
        return <h3 key={idx} style={{ fontSize: "0.95rem", fontWeight: 600, margin: "0.6rem 0 0.3rem" }}>{line.slice(4)}</h3>;
      }
      if (line.startsWith("- [x] ")) {
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: "rgb(var(--muted))", textDecoration: "line-through" }}>
            <input type="checkbox" checked readOnly style={{ accentColor: "rgb(var(--accent))" }} />
            <span>{line.slice(6)}</span>
          </div>
        );
      }
      if (line.startsWith("- [ ] ")) {
        return (
          <div key={idx} style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem" }}>
            <input type="checkbox" readOnly />
            <span>{line.slice(6)}</span>
          </div>
        );
      }
      if (line.startsWith("- ")) {
        return (
          <li key={idx} style={{ fontSize: "0.82rem", marginLeft: "1.2rem", lineHeight: 1.6 }}>
            {line.slice(2)}
          </li>
        );
      }
      if (line.startsWith("```")) {
        return (
          <div key={idx} style={{ background: "rgb(var(--surface-strong))", padding: "0.6rem 0.8rem", borderRadius: "var(--radius-sm)", fontFamily: "monospace", fontSize: "0.76rem", margin: "0.5rem 0" }}>
            <code>{line}</code>
          </div>
        );
      }
      if (line.trim() === "") {
        return <div key={idx} style={{ height: "0.5rem" }} />;
      }
      return <p key={idx} style={{ fontSize: "0.82rem", lineHeight: 1.6, margin: "0.2rem 0" }}>{line}</p>;
    });
  };

  return (
    <div className="notes-view">
      {/* Header */}
      <section className="module-header">
        <div className="module-header__icon"><NotebookTabs /></div>
        <div>
          <p className="eyebrow">Knowledge & Documentation / Markdown</p>
          <h1>Notes & Knowledge Base</h1>
          <p>Organize project documentation, business recipes, client notes, and technical cheat-sheets.</p>
        </div>
        <button className="primary-button" onClick={handleCreateNote}>
          <Plus /> New Note
        </button>
      </section>

      {/* Main Split Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "18rem 1fr", gap: "1.2rem", alignItems: "start" }}>
        {/* Left Sidebar: Search, Folders, Note List */}
        <aside style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: "var(--radius-lg)", padding: "1rem" }}>
          {/* Search Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", background: "rgb(var(--surface-strong))", border: "1px solid rgb(var(--border))", borderRadius: "var(--radius)", padding: "0.35rem 0.6rem", marginBottom: "0.8rem" }}>
            <Search style={{ width: "0.85rem", height: "0.85rem", color: "rgb(var(--muted))" }} />
            <input
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ background: "transparent", border: 0, fontSize: "0.78rem", width: "100%", color: "rgb(var(--foreground))" }}
            />
          </div>

          {/* Folder Filter */}
          <div style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.3rem" }}>
              <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgb(var(--muted))", textTransform: "uppercase" }}>Folders</span>
              <button
                type="button"
                onClick={() => setShowNewFolder(!showNewFolder)}
                style={{ background: "transparent", border: 0, cursor: "pointer", fontSize: "0.7rem", color: "rgb(var(--accent))", fontWeight: 600 }}
              >
                + Add
              </button>
            </div>

            {showNewFolder ? (
              <div style={{ display: "flex", gap: "0.3rem", marginBottom: "0.4rem" }}>
                <input
                  placeholder="Folder name..."
                  value={newFolderInput}
                  onChange={(e) => setNewFolderInput(e.target.value)}
                  style={{ flex: 1, fontSize: "0.72rem", padding: "0.2rem 0.4rem", borderRadius: "var(--radius-sm)", border: "1px solid rgb(var(--border))" }}
                />
                <button type="button" onClick={handleAddFolder} className="primary-button" style={{ padding: "0.2rem 0.5rem", fontSize: "0.7rem" }}>
                  Save
                </button>
              </div>
            ) : null}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
              <button
                type="button"
                className={cn("selection-row", !selectedFolder && "selection-row--selected")}
                style={{ padding: "0.35rem 0.6rem", fontSize: "0.74rem" }}
                onClick={() => setSelectedFolder(null)}
              >
                <Folder style={{ width: "0.8rem", height: "0.8rem" }} />
                <span>All Folders</span>
              </button>
              {folders.map((f) => (
                <button
                  type="button"
                  key={f.id}
                  className={cn("selection-row", selectedFolder === f.id && "selection-row--selected")}
                  style={{ padding: "0.35rem 0.6rem", fontSize: "0.74rem" }}
                  onClick={() => setSelectedFolder(f.id)}
                >
                  <Folder style={{ width: "0.8rem", height: "0.8rem" }} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tag Pills */}
          {allTags.length > 0 ? (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgb(var(--muted))", textTransform: "uppercase", marginBottom: "0.3rem" }}>Tags</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                    style={{
                      border: 0,
                      borderRadius: "999px",
                      padding: "0.15rem 0.45rem",
                      fontSize: "0.65rem",
                      fontWeight: 600,
                      background: selectedTag === tag ? "rgb(var(--accent))" : "rgb(var(--surface-strong))",
                      color: selectedTag === tag ? "white" : "rgb(var(--muted))",
                      cursor: "pointer"
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Notes List */}
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "rgb(var(--muted))", textTransform: "uppercase", marginBottom: "0.4rem" }}>
              Notes ({filteredNotes.length})
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: "28rem", overflowY: "auto" }}>
              {filteredNotes.map((note) => {
                const isActive = note.id === activeNote?.id;
                const ws = WORKSPACE_OPTIONS.find((w) => w.slug === note.workspaceId);
                return (
                  <div
                    key={note.id}
                    onClick={() => setActiveNoteId(note.id)}
                    style={{
                      background: isActive ? "rgb(var(--surface-strong))" : "transparent",
                      border: isActive ? "1px solid rgb(var(--accent))" : "1px solid rgb(var(--border))",
                      borderRadius: "var(--radius)",
                      padding: "0.55rem 0.75rem",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.2rem" }}>
                      <strong style={{ fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                        {note.title || "Untitled"}
                      </strong>
                      {note.isPinned ? <Pin style={{ width: "0.7rem", height: "0.7rem", color: "rgb(var(--accent))", flexShrink: 0 }} /> : null}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.66rem", color: "rgb(var(--muted))" }}>
                      {ws ? <span className={cn("workspace-pill-badge", ws.dot)} style={{ fontSize: "0.52rem", padding: "0.1rem 0.35rem" }}>{ws.label.split(" ")[0]}</span> : null}
                      <span>{note.updatedAt}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Editor & Preview Pane */}
        {activeNote ? (
          <main style={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--border))", borderRadius: "var(--radius-lg)", padding: "1.2rem", minHeight: "36rem" }}>
            {/* Editor Toolbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <button
                  type="button"
                  className={cn("icon-button", activeNote.isPinned && "check-toggle--done")}
                  title={activeNote.isPinned ? "Unpin note" : "Pin note"}
                  onClick={() => handleUpdateActiveNote({ isPinned: !activeNote.isPinned })}
                >
                  <Pin style={{ width: "1rem", height: "1rem" }} />
                </button>
                <span style={{ fontSize: "0.72rem", color: "rgb(var(--muted))" }}>
                  Last updated: {activeNote.updatedAt}
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div className="segmented">
                  <button
                    type="button"
                    className={cn("segmented__option", previewMode === "edit" && "segmented__option--active")}
                    onClick={() => setPreviewMode("edit")}
                  >
                    <Edit3 style={{ width: "0.8rem", height: "0.8rem" }} /> Edit
                  </button>
                  <button
                    type="button"
                    className={cn("segmented__option", previewMode === "split" && "segmented__option--active")}
                    onClick={() => setPreviewMode("split")}
                  >
                    Split
                  </button>
                  <button
                    type="button"
                    className={cn("segmented__option", previewMode === "preview" && "segmented__option--active")}
                    onClick={() => setPreviewMode("preview")}
                  >
                    <Eye style={{ width: "0.8rem", height: "0.8rem" }} /> Preview
                  </button>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  title="Delete note"
                  onClick={() => handleDeleteNote(activeNote.id)}
                >
                  <Trash2 style={{ width: "1rem", height: "1rem" }} />
                </button>
              </div>
            </div>

            {/* Title Input */}
            <input
              className="title-input"
              value={activeNote.title}
              onChange={(e) => handleUpdateActiveNote({ title: e.target.value })}
              placeholder="Note Title"
              style={{ fontSize: "1.3rem", fontWeight: 800, marginBottom: "0.8rem" }}
            />

            {/* Split or Single Content View */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: previewMode === "split" ? "1fr 1fr" : "1fr",
                gap: "1.2rem",
                borderTop: "1px solid rgb(var(--border))",
                paddingTop: "1rem"
              }}
            >
              {previewMode !== "preview" ? (
                <div>
                  <textarea
                    value={activeNote.content}
                    onChange={(e) => handleUpdateActiveNote({ content: e.target.value })}
                    placeholder="Write markdown content here..."
                    style={{
                      width: "100%",
                      minHeight: "26rem",
                      background: "transparent",
                      border: 0,
                      fontFamily: "monospace",
                      fontSize: "0.82rem",
                      lineHeight: 1.6,
                      resize: "vertical",
                      color: "rgb(var(--foreground))"
                    }}
                  />
                </div>
              ) : null}

              {previewMode !== "edit" ? (
                <div style={{ background: "rgb(var(--surface-strong))", padding: "1rem", borderRadius: "var(--radius)", minHeight: "26rem", overflowY: "auto" }}>
                  {renderMarkdown(activeNote.content)}
                </div>
              ) : null}
            </div>
          </main>
        ) : (
          <div style={{ padding: "3rem", textAlign: "center", color: "rgb(var(--muted))" }}>
            No note selected. Choose a note or click &quot;New Note&quot; to begin.
          </div>
        )}
      </div>
    </div>
  );
}
