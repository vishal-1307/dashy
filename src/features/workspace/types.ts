export type ModuleKey =
  | "dashboard"
  | "projects"
  | "tasks"
  | "calendar"
  | "knowledge"
  | "notes"
  | "ideas"
  | "documents"
  | "learning"
  | "goals"
  | "habits"
  | "journal"
  | "finance"
  | "crm"
  | "school"
  | "ngo"
  | "contacts"
  | "analytics"
  | "settings";

export type Priority = "low" | "medium" | "high" | "urgent";

export type ItemStatus =
  | "idea"
  | "planned"
  | "active"
  | "waiting"
  | "done"
  | "archived";

export type ThemeMode = "light" | "dark" | "system";

export type WorkspaceItem = {
  id: string;
  module: ModuleKey;
  title: string;
  description: string;
  status: ItemStatus;
  priority: Priority;
  dueDate?: string;
  progress: number;
  tags: string[];
  linkedProject?: string;
  createdAt: string;
  updatedAt: string;
};

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  description: string;
  accent: string;
};

export type QuickCaptureInput = {
  module: ModuleKey;
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  tags?: string[];
};
