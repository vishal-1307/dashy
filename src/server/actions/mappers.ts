import type { Milestone as DbMilestone, Priority as DbPriority, Project, Task, WorkStatus } from "@prisma/client";
import type { ItemStatus, Priority, WorkspaceItem, WorkspaceSlug } from "@/features/workspace/types";

export function statusToDb(status: ItemStatus): WorkStatus {
  return status.toUpperCase() as WorkStatus;
}

export function statusFromDb(status: WorkStatus): ItemStatus {
  return status.toLowerCase() as ItemStatus;
}

export function priorityToDb(priority: Priority): DbPriority {
  return priority.toUpperCase() as DbPriority;
}

export function priorityFromDb(priority: DbPriority): Priority {
  return priority.toLowerCase() as Priority;
}

export function dateToDb(date: string | null | undefined): Date | null {
  if (!date) return null;
  const d = date.includes("T") ? new Date(date) : new Date(`${date}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

export function dateFromDb(date: Date | null | undefined): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

export function taskToItem(
  task: Task & {
    workspace?: { slug: string } | null;
    subtasks?: Task[];
  }
): WorkspaceItem {
  return {
    id: task.id,
    module: "tasks",
    workspace: (task.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    title: task.title,
    description: task.description ?? "",
    status: statusFromDb(task.status),
    priority: priorityFromDb(task.priority),
    dueDate: dateFromDb(task.dueDate),
    progress: task.progress,
    tags: [],
    subtasks: task.subtasks?.map((st) => ({
      id: st.id,
      title: st.title,
      completed: st.status === "DONE"
    })),
    previousStatus: task.previousStatus ? statusFromDb(task.previousStatus) : undefined,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export function projectToItem(
  project: Project & {
    workspace?: { slug: string } | null;
    milestones?: DbMilestone[];
  }
): WorkspaceItem {
  return {
    id: project.id,
    module: "projects",
    workspace: (project.workspace?.slug as WorkspaceSlug) ?? "freelance-software",
    title: project.title,
    description: project.description ?? "",
    status: statusFromDb(project.status),
    priority: priorityFromDb(project.priority),
    dueDate: dateFromDb(project.deadline),
    progress: project.progress,
    tags: [],
    blockers: project.blockers ? project.blockers.split("\n").filter(Boolean) : undefined,
    nextAction: project.nextAction ?? undefined,
    milestones: project.milestones?.map((m) => ({
      id: m.id,
      title: m.title,
      completed: m.status === "DONE",
      dueDate: dateFromDb(m.dueDate)
    })),
    previousStatus: project.previousStatus ? statusFromDb(project.previousStatus) : undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}
