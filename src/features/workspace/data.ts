import type { ModuleDefinition } from "./types";

export const modules: ModuleDefinition[] = [
  { key: "dashboard", label: "Dashboard", description: "Today, progress, and command center", accent: "bg-sky-500" },
  { key: "projects", label: "Projects", description: "Roadmaps, milestones, tasks, files", accent: "bg-blue-600" },
  { key: "tasks", label: "Tasks", description: "Today, upcoming, recurring, blocked", accent: "bg-emerald-500" },
  { key: "calendar", label: "Calendar", description: "Events, deadlines, reminders", accent: "bg-cyan-500" },
  { key: "knowledge", label: "Knowledge Base", description: "Pages, backlinks, summaries", accent: "bg-indigo-500" },
  { key: "notes", label: "Notes", description: "Markdown notes and quick thoughts", accent: "bg-slate-500" },
  { key: "ideas", label: "Ideas", description: "Research, potential value, planning", accent: "bg-violet-500" },
  { key: "documents", label: "Documents", description: "Files, certificates, invoices", accent: "bg-amber-500" },
  { key: "learning", label: "Learning", description: "Courses, resources, revision", accent: "bg-teal-500" },
  { key: "goals", label: "Goals", description: "Daily through lifetime outcomes", accent: "bg-rose-500" },
  { key: "habits", label: "Habits", description: "Streaks, heatmaps, routines", accent: "bg-lime-500" },
  { key: "journal", label: "Journal", description: "Wins, lessons, reviews, mood", accent: "bg-orange-500" },
  { key: "finance", label: "Finance", description: "Income, expenses, budgets", accent: "bg-green-600" },
  { key: "crm", label: "CRM", description: "Leads, clients, proposals", accent: "bg-fuchsia-500" },
  { key: "school", label: "School CRM", description: "Schools, demos, follow-ups", accent: "bg-purple-500" },
  { key: "ngo", label: "NGO", description: "Projects, volunteers, reports", accent: "bg-red-500" },
  { key: "contacts", label: "Contacts", description: "People and interaction history", accent: "bg-neutral-500" },
  { key: "analytics", label: "Analytics", description: "Productivity and progress reports", accent: "bg-stone-500" },
  { key: "settings", label: "Settings", description: "Profile, security, integrations", accent: "bg-zinc-500" }
];

export const priorityRank = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};
