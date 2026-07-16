import type { Priority as DbPriority, Project, Task, WorkStatus } from "@prisma/client";
import type { ItemStatus, Priority, WorkspaceItem } from "@/features/workspace/types";

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
  return date ? new Date(`${date}T00:00:00.000Z`) : null;
}

export function dateFromDb(date: Date | null): string | undefined {
  return date ? date.toISOString().slice(0, 10) : undefined;
}

// Tags and linkedProject aren't wired to the relational Tag/Project-lookup
// yet — quick capture never sets them, so this preserves current behavior
// (both simplifications are called out in the stage-2 report).
export function taskToItem(task: Task): WorkspaceItem {
  return {
    id: task.id,
    module: "tasks",
    title: task.title,
    description: task.description ?? "",
    status: statusFromDb(task.status),
    priority: priorityFromDb(task.priority),
    dueDate: dateFromDb(task.dueDate),
    progress: task.progress,
    tags: [],
    previousStatus: task.previousStatus ? statusFromDb(task.previousStatus) : undefined,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString()
  };
}

export function projectToItem(project: Project): WorkspaceItem {
  return {
    id: project.id,
    module: "projects",
    title: project.title,
    description: project.description ?? "",
    status: statusFromDb(project.status),
    priority: priorityFromDb(project.priority),
    dueDate: dateFromDb(project.deadline),
    progress: project.progress,
    tags: [],
    previousStatus: project.previousStatus ? statusFromDb(project.previousStatus) : undefined,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString()
  };
}
