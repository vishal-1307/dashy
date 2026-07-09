import type { ModuleDefinition, WorkspaceItem } from "./types";

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

const now = new Date();
const date = (offset: number) => {
  const next = new Date(now);
  next.setDate(now.getDate() + offset);
  return next.toISOString().slice(0, 10);
};

export const seedItems: WorkspaceItem[] = [
  {
    id: "project-dashy-launch",
    module: "projects",
    title: "Dashy private beta",
    description: "Ship the first usable version with dashboard, core CRUD, and workspace search.",
    status: "active",
    priority: "urgent",
    dueDate: date(10),
    progress: 64,
    tags: ["product", "launch"],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  },
  {
    id: "task-schema-review",
    module: "tasks",
    title: "Review relational schema",
    description: "Validate module relationships before wiring server actions to Prisma.",
    status: "planned",
    priority: "high",
    dueDate: date(1),
    progress: 20,
    tags: ["database", "backend"],
    linkedProject: "Dashy private beta",
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  },
  {
    id: "note-pricing",
    module: "notes",
    title: "Pricing positioning",
    description: "Keep the app personal-first, then expand toward team workspaces later.",
    status: "active",
    priority: "medium",
    progress: 45,
    tags: ["strategy"],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  },
  {
    id: "idea-ai-briefing",
    module: "ideas",
    title: "AI daily briefing",
    description: "Generate a morning plan from overdue tasks, calendar load, and goals.",
    status: "idea",
    priority: "high",
    dueDate: date(7),
    progress: 10,
    tags: ["ai", "dashboard"],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  },
  {
    id: "goal-learning",
    module: "learning",
    title: "Cybersecurity roadmap",
    description: "Track modules, lab hours, notes, quizzes, and certificates.",
    status: "active",
    priority: "medium",
    dueDate: date(28),
    progress: 38,
    tags: ["study", "security"],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  },
  {
    id: "finance-budget",
    module: "finance",
    title: "Monthly operating budget",
    description: "Categorize subscriptions, invoices, savings, and business expenses.",
    status: "waiting",
    priority: "medium",
    dueDate: date(3),
    progress: 52,
    tags: ["money", "reports"],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }
];

export const priorityRank = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};
