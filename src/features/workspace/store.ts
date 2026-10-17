"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { toast } from "sonner";
import { createProject, deleteProject, listProjects, restoreProject, updateProject } from "@/server/actions/projects";
import { createTask, deleteTask, listTasks, restoreTask, updateTask } from "@/server/actions/tasks";
import { track } from "@/shared/lib/analytics";
import type { ItemStatus, ModuleKey, QuickCaptureInput, ThemeMode, WorkspaceExport, WorkspaceItem, WorkspaceSlug } from "./types";

export const FOCUS_SESSION_SECONDS = 25 * 60;

/** Modules whose data lives in the database (grows as modules migrate). */
export const DB_BACKED_MODULES: ModuleKey[] = ["tasks", "projects"];

/** Modules that can never be hidden. */
export const CORE_MODULES: ModuleKey[] = ["dashboard", "tasks", "projects", "settings"];

/** Personal/venture-specific modules, tucked behind the "advanced" group. */
export const ADVANCED_MODULES: ModuleKey[] = ["school", "ngo"];

/**
 * Default hidden set for NEW users: a curated sidebar beats 19 entries.
 * Existing users are migrated to an empty list (nothing taken away) — see
 * the persist migrate() below.
 */
export const DEFAULT_HIDDEN_MODULES: ModuleKey[] = [
  "ideas",
  "documents",
  "learning",
  "knowledge",
  "finance",
  "crm",
  "contacts",
  "analytics",
  "school",
  "ngo"
];

type DeletedEntry = {
  item: WorkspaceItem;
  index: number;
};

type WorkspaceState = {
  activeModule: ModuleKey;
  activeWorkspace: WorkspaceSlug;
  items: WorkspaceItem[];
  query: string;
  focusMode: boolean;
  sidebarOpen: boolean;
  commandOpen: boolean;
  captureOpen: boolean;
  theme: ThemeMode;
  dashboardOrder: string[];
  dashboardVisibleIds: string[];
  /** True once the user has passed the lock screen this session. Not persisted. */
  unlocked: boolean;
  timerSeconds: number;
  timerRunning: boolean;
  /** Modules the user has hidden from the sidebar (visibility, not security). */
  hiddenModules: ModuleKey[];
  /** Whether the one-time "import your local Tasks/Projects" prompt was already resolved. */
  legacyImportPromptShown: boolean;
  /** Local tasks/projects not found on the server after the last hydration. Not persisted. */
  legacyImportCandidateIds: string[];
  /** Guards against re-fetching on every re-render. Not persisted. */
  hasHydrated: boolean;
  setActiveModule: (module: ModuleKey) => void;
  setActiveWorkspace: (workspace: WorkspaceSlug) => void;
  setQuery: (query: string) => void;
  setFocusMode: (value: boolean) => void;
  setSidebarOpen: (value: boolean) => void;
  setCommandOpen: (value: boolean) => void;
  setCaptureOpen: (value: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleModuleVisibility: (module: ModuleKey) => void;
  setUnlocked: (value: boolean) => void;
  setTimerRunning: (value: boolean) => void;
  resetTimer: () => void;
  tickTimer: () => void;
  toggleDashboardItem: (id: string) => void;
  reorderDashboardItem: (activeId: string, overId: string) => void;
  createItem: (input: QuickCaptureInput) => WorkspaceItem;
  updateItem: (id: string, updates: Partial<WorkspaceItem>) => void;
  deleteItem: (id: string) => DeletedEntry | null;
  restoreDeletedItem: (entry: DeletedEntry) => void;
  archiveItem: (id: string) => void;
  restoreItem: (id: string) => void;
  importWorkspace: (data: WorkspaceExport) => void;
  clearWorkspace: () => void;
  /** Fetches this user's Tasks/Projects from the DB and merges them into items. */
  hydrateFromServer: () => Promise<void>;
  /** Sends the given legacy local-only Task/Project ids to the server. */
  importLegacyItems: (ids: string[]) => Promise<void>;
  dismissLegacyImport: () => void;
  /**
   * Drops the cached Tasks/Projects slice and hydration bookkeeping on sign
   * out, so a different account signing in on this device doesn't see the
   * previous account's DB-backed items before the next hydration replaces
   * them, and isn't offered them as an "import your local data" prompt.
   */
  resetForSignOut: () => void;
};

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const ongoing = (item: WorkspaceItem) => item.status === "active" || item.status === "planned";
const isDbBacked = (module: ModuleKey) => DB_BACKED_MODULES.includes(module);

const actionsFor = (module: ModuleKey) =>
  module === "tasks"
    ? { create: createTask, update: updateTask, remove: deleteTask, restore: restoreTask, list: listTasks }
    : { create: createProject, update: updateProject, remove: deleteProject, restore: restoreProject, list: listProjects };

// Tracks in-flight deletes so an "Undo" click waits for the real delete to
// land before asking the server to recreate the row (avoids a recreate
// racing ahead of, and then being clobbered by, the delete it's undoing).
// Resolves true if the row is confirmed gone server-side (or never existed
// there), false if the delete failed and was already rolled back locally.
const pendingDeletes = new Map<string, Promise<boolean>>();

// Debounces rapid edits (every keystroke, every slider tick) into a single
// server write per item, so autosave doesn't hammer the DB or let a stale
// rollback clobber a newer edit that landed while an older one was in flight.
const UPDATE_DEBOUNCE_MS = 600;
const pendingUpdateTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingUpdateSnapshots = new Map<string, WorkspaceItem>();
const pendingUpdatePayloads = new Map<string, Record<string, unknown>>();

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      activeModule: "dashboard",
      activeWorkspace: "unified",
      items: [],
      query: "",
      focusMode: false,
      sidebarOpen: true,
      commandOpen: false,
      captureOpen: false,
      theme: "system",
      dashboardOrder: [],
      dashboardVisibleIds: [],
      hiddenModules: DEFAULT_HIDDEN_MODULES,
      unlocked: false,
      timerSeconds: FOCUS_SESSION_SECONDS,
      timerRunning: false,
      legacyImportPromptShown: false,
      legacyImportCandidateIds: [],
      hasHydrated: false,
      setActiveModule: (module) => set({ activeModule: module }),
      setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),
      setQuery: (query) => set({ query }),
      setFocusMode: (value) => set({ focusMode: value }),
      setSidebarOpen: (value) => set({ sidebarOpen: value }),
      setCommandOpen: (value) => set({ commandOpen: value }),
      setCaptureOpen: (value) => set({ captureOpen: value }),
      setTheme: (theme) => set({ theme }),
      toggleModuleVisibility: (module) => {
        if (CORE_MODULES.includes(module)) return;
        const hidden = get().hiddenModules;
        set({
          hiddenModules: hidden.includes(module)
            ? hidden.filter((key) => key !== module)
            : [...hidden, module]
        });
      },
      setUnlocked: (value) => set({ unlocked: value }),
      setTimerRunning: (value) =>
        set((state) => ({
          timerRunning: value,
          timerSeconds: value && state.timerSeconds === 0 ? FOCUS_SESSION_SECONDS : state.timerSeconds
        })),
      resetTimer: () => set({ timerRunning: false, timerSeconds: FOCUS_SESSION_SECONDS }),
      tickTimer: () =>
        set((state) => {
          if (!state.timerRunning) return state;
          if (state.timerSeconds <= 1) {
            return { timerSeconds: 0, timerRunning: false };
          }
          return { timerSeconds: state.timerSeconds - 1 };
        }),
      toggleDashboardItem: (id) => {
        const visible = get().dashboardVisibleIds;
        set({
          dashboardVisibleIds: visible.includes(id)
            ? visible.filter((itemId) => itemId !== id)
            : [...visible, id],
          dashboardOrder: get().dashboardOrder.includes(id)
            ? get().dashboardOrder
            : [...get().dashboardOrder, id]
        });
      },
      reorderDashboardItem: (activeId, overId) => {
        if (activeId === overId) {
          return;
        }

        const order = [...get().dashboardOrder];
        const from = order.indexOf(activeId);
        const to = order.indexOf(overId);

        if (from < 0 || to < 0) {
          return;
        }

        order.splice(from, 1);
        order.splice(to, 0, activeId);
        set({ dashboardOrder: order });
      },
      createItem: (input) => {
        const timestamp = new Date().toISOString();
        const currentWs = get().activeWorkspace;
        const assignedWorkspace = input.workspace ?? (currentWs === "unified" ? "freelance-software" : currentWs);
        const item: WorkspaceItem = {
          id: uid(),
          module: input.module,
          workspace: assignedWorkspace,
          title: input.title.trim(),
          description: input.description?.trim() ?? "",
          priority: input.priority ?? "medium",
          status: "planned",
          dueDate: input.dueDate || undefined,
          progress: 0,
          tags: input.tags ?? [],
          createdAt: timestamp,
          updatedAt: timestamp
        };

        set({
          items: [item, ...get().items],
          dashboardOrder: [item.id, ...get().dashboardOrder],
          dashboardVisibleIds: [item.id, ...get().dashboardVisibleIds]
        });
        track("item_created", { module: item.module });

        if (isDbBacked(item.module)) {
          const { create } = actionsFor(item.module);
          create({
            id: item.id,
            module: item.module,
            title: item.title,
            description: item.description,
            priority: item.priority,
            dueDate: item.dueDate,
            tags: []
          })
            .then((serverItem) => {
              if (serverItem && serverItem.id !== item.id) {
                set({
                  items: get().items.map((entry) => (entry.id === item.id ? serverItem : entry)),
                  dashboardOrder: get().dashboardOrder.map((id) => (id === item.id ? serverItem.id : id)),
                  dashboardVisibleIds: get().dashboardVisibleIds.map((id) => (id === item.id ? serverItem.id : id))
                });
              }
            })
            .catch(() => {
              set({
                items: get().items.filter((entry) => entry.id !== item.id),
                dashboardOrder: get().dashboardOrder.filter((entryId) => entryId !== item.id),
                dashboardVisibleIds: get().dashboardVisibleIds.filter((entryId) => entryId !== item.id)
              });
              toast.error(`Could not save "${item.title}" — removed.`);
            });
        }

        return item;
      },
      updateItem: (id, updates) => {
        const current = get().items.find((item) => item.id === id);
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
          )
        });

        if (!current || !isDbBacked(current.module)) {
          return;
        }

        if (!pendingUpdateSnapshots.has(id)) {
          pendingUpdateSnapshots.set(id, current);
        }
        const payload = pendingUpdatePayloads.get(id) ?? {};
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.priority !== undefined) payload.priority = updates.priority;
        if (updates.progress !== undefined) payload.progress = updates.progress;
        if ("dueDate" in updates) payload.dueDate = updates.dueDate ?? null;
        if ("previousStatus" in updates) payload.previousStatus = updates.previousStatus ?? null;
        pendingUpdatePayloads.set(id, payload);

        const existingTimer = pendingUpdateTimers.get(id);
        if (existingTimer) clearTimeout(existingTimer);

        pendingUpdateTimers.set(
          id,
          setTimeout(() => {
            const targetModule = get().items.find((item) => item.id === id)?.module ?? current.module;
            const snapshot = pendingUpdateSnapshots.get(id) ?? current;
            const finalPayload = pendingUpdatePayloads.get(id) ?? {};
            pendingUpdateTimers.delete(id);
            pendingUpdateSnapshots.delete(id);
            pendingUpdatePayloads.delete(id);

            const { update } = actionsFor(targetModule);
            update(id, finalPayload).catch(() => {
              set({
                items: get().items.map((item) => (item.id === id ? snapshot : item))
              });
              toast.error(`Could not save changes to "${snapshot.title}" — reverted.`);
            });
          }, UPDATE_DEBOUNCE_MS)
        );
      },
      deleteItem: (id) => {
        const items = get().items;
        const index = items.findIndex((item) => item.id === id);
        if (index < 0) {
          return null;
        }
        const item = items[index];
        set({ items: items.filter((entry) => entry.id !== id) });

        if (isDbBacked(item.module)) {
          const { remove } = actionsFor(item.module);
          const promise = remove(id)
            .then(() => true)
            .catch(() => {
              const currentItems = get().items;
              if (!currentItems.some((entry) => entry.id === id)) {
                const restoreIndex = Math.min(index, currentItems.length);
                const next = [...currentItems];
                next.splice(restoreIndex, 0, item);
                set({ items: next });
              }
              toast.error(`Could not delete "${item.title}" — restored.`);
              return false;
            })
            .finally(() => {
              pendingDeletes.delete(id);
            });
          pendingDeletes.set(id, promise);
        }

        return { item, index };
      },
      restoreDeletedItem: ({ item, index }) => {
        const items = [...get().items];
        if (items.some((entry) => entry.id === item.id)) {
          return;
        }
        items.splice(Math.min(index, items.length), 0, item);
        set({ items });

        if (!isDbBacked(item.module)) {
          return;
        }

        void (async () => {
          const pending = pendingDeletes.get(item.id);
          const deleteConfirmed = pending ? await pending : true;
          if (!deleteConfirmed) {
            // Delete never actually happened server-side (already rolled back); nothing to recreate.
            return;
          }
          const { restore } = actionsFor(item.module);
          try {
            await restore(item);
          } catch {
            set({ items: get().items.filter((entry) => entry.id !== item.id) });
            toast.error(`Could not restore "${item.title}" — try again.`);
          }
        })();
      },
      archiveItem: (id) => {
        const current = get().items.find((item) => item.id === id);
        get().updateItem(id, {
          status: "archived",
          previousStatus: current && current.status !== "archived" ? current.status : undefined
        });
      },
      restoreItem: (id) => {
        const current = get().items.find((item) => item.id === id);
        get().updateItem(id, {
          status: (current?.previousStatus ?? "active") as ItemStatus,
          previousStatus: undefined
        });
      },
      importWorkspace: (data) => {
        const items = data.items;
        const ids = new Set(items.map((item) => item.id));
        const order = (data.dashboardOrder ?? items.filter(ongoing).map((item) => item.id)).filter((id) =>
          ids.has(id)
        );
        const visible = (
          data.dashboardVisibleIds ?? items.filter(ongoing).slice(0, 4).map((item) => item.id)
        ).filter((id) => ids.has(id));
        set({
          items,
          dashboardOrder: order,
          dashboardVisibleIds: visible,
          ...(data.theme ? { theme: data.theme } : {})
        });
      },
      clearWorkspace: () => set({ items: [], dashboardOrder: [], dashboardVisibleIds: [] }),
      hydrateFromServer: async () => {
        const [serverTasks, serverProjects] = await Promise.all([listTasks(), listProjects()]);
        const serverItems = [...serverTasks, ...serverProjects];
        const serverIds = new Set(serverItems.map((item) => item.id));

        const state = get();
        const nonDbItems = state.items.filter((item) => !isDbBacked(item.module));
        const localOnlyDbItems = state.items.filter(
          (item) => isDbBacked(item.module) && !serverIds.has(item.id)
        );

        set({
          items: [...serverItems, ...localOnlyDbItems, ...nonDbItems],
          legacyImportCandidateIds: state.legacyImportPromptShown ? [] : localOnlyDbItems.map((item) => item.id),
          hasHydrated: true
        });
      },
      importLegacyItems: async (ids) => {
        const items = get().items.filter((item) => ids.includes(item.id));
        await Promise.all(
          items.map(async (item) => {
            const { create } = actionsFor(item.module);
            await create({
              id: item.id,
              module: item.module,
              title: item.title,
              description: item.description,
              priority: item.priority,
              dueDate: item.dueDate,
              tags: []
            });
          })
        );
        set({ legacyImportPromptShown: true, legacyImportCandidateIds: [] });
      },
      dismissLegacyImport: () => set({ legacyImportPromptShown: true, legacyImportCandidateIds: [] }),
      resetForSignOut: () => {
        // Cancel queued/debounced server writes so nothing fires for the
        // previous account after sign-out.
        for (const timer of pendingUpdateTimers.values()) {
          clearTimeout(timer);
        }
        pendingUpdateTimers.clear();
        pendingUpdateSnapshots.clear();
        pendingUpdatePayloads.clear();
        pendingDeletes.clear();

        // Clear in-memory session data completely to prevent cross-account leakage
        set({
          items: [],
          dashboardOrder: [],
          dashboardVisibleIds: [],
          legacyImportPromptShown: true,
          legacyImportCandidateIds: [],
          hasHydrated: false,
          unlocked: false
        });

        // Clear authenticated session cache without touching legacy dashy-workspace-v1
        try {
          if (typeof window !== "undefined") {
            window.localStorage.removeItem("dashy-session-cache-v2");
          }
        } catch {
          // localStorage may be unavailable
        }
      }
    }),
    {
      name: "dashy-session-cache-v2",
      version: 2,
      // Existing browsers (persisted before hiddenModules existed) keep every
      // module visible — the curated default only applies to brand-new users.
      migrate: (persisted, version) => {
        const state = persisted as Partial<WorkspaceState>;
        if (version < 2) {
          state.hiddenModules = [];
        }
        return state as WorkspaceState;
      },
      partialize: (state) => ({
        items: state.items,
        theme: state.theme,
        activeWorkspace: state.activeWorkspace,
        dashboardOrder: state.dashboardOrder,
        dashboardVisibleIds: state.dashboardVisibleIds,
        hiddenModules: state.hiddenModules,
        legacyImportPromptShown: true
      })
    }
  )
);
