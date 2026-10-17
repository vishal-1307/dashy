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
  | "jobs"
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

export type WorkspaceSlug =
  | "unified"
  | "freelance-software"
  | "dkom"
  | "diamond-jewellers"
  | "mithila-kritikala"
  | "personal";

export type Subtask = {
  id: string;
  title: string;
  completed: boolean;
};

export type Milestone = {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
};

export type ThemeMode = "light" | "dark" | "system";

export type WorkspaceItem = {
  id: string;
  module: ModuleKey;
  workspace?: WorkspaceSlug;
  title: string;
  description: string;
  status: ItemStatus;
  priority: Priority;
  dueDate?: string;
  progress: number;
  tags: string[];
  linkedProject?: string;
  subtasks?: Subtask[];
  milestones?: Milestone[];
  blockers?: string[];
  nextAction?: string;
  timeEstimateMinutes?: number;
  timeSpentMinutes?: number;
  dealValue?: number;
  clientStage?: string;
  contactEmail?: string;
  contactPhone?: string;
  nextFollowUpAt?: string;
  invoiceNumber?: string;
  totalAmount?: number;
  amountPaid?: number;
  outstandingBalance?: number;
  jobCompany?: string;
  jobRole?: string;
  jobStage?: string;
  jobSalary?: string;
  calendarStartAt?: string;
  calendarEndAt?: string;
  noteContent?: string;
  folder?: string;
  /** Status the item had before it was archived, so restore can put it back. */
  previousStatus?: ItemStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceExport = {
  app: "dashy";
  version: number;
  exportedAt: string;
  theme?: ThemeMode;
  items: WorkspaceItem[];
  dashboardOrder?: string[];
  dashboardVisibleIds?: string[];
};

export type ModuleDefinition = {
  key: ModuleKey;
  label: string;
  description: string;
  accent: string;
};

export type QuickCaptureInput = {
  module: ModuleKey;
  workspace?: WorkspaceSlug;
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string;
  tags?: string[];
};
