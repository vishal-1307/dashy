"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seedItems } from "./data";
import type { ItemStatus, ModuleKey, QuickCaptureInput, ThemeMode, WorkspaceExport, WorkspaceItem } from "./types";

export const FOCUS_SESSION_SECONDS = 25 * 60;

type DeletedEntry = {
  item: WorkspaceItem;
  index: number;
};

type WorkspaceState = {
  activeModule: ModuleKey;
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
  setActiveModule: (module: ModuleKey) => void;
  setQuery: (query: string) => void;
  setFocusMode: (value: boolean) => void;
  setSidebarOpen: (value: boolean) => void;
  setCommandOpen: (value: boolean) => void;
  setCaptureOpen: (value: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
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
};

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const ongoing = (item: WorkspaceItem) => item.status === "active" || item.status === "planned";

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      activeModule: "dashboard",
      items: seedItems,
      query: "",
      focusMode: false,
      sidebarOpen: true,
      commandOpen: false,
      captureOpen: false,
      theme: "system",
      dashboardOrder: seedItems.filter(ongoing).map((item) => item.id),
      dashboardVisibleIds: seedItems.filter(ongoing).slice(0, 4).map((item) => item.id),
      unlocked: false,
      timerSeconds: FOCUS_SESSION_SECONDS,
      timerRunning: false,
      setActiveModule: (module) => set({ activeModule: module }),
      setQuery: (query) => set({ query }),
      setFocusMode: (value) => set({ focusMode: value }),
      setSidebarOpen: (value) => set({ sidebarOpen: value }),
      setCommandOpen: (value) => set({ commandOpen: value }),
      setCaptureOpen: (value) => set({ captureOpen: value }),
      setTheme: (theme) => set({ theme }),
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
        const item: WorkspaceItem = {
          id: uid(),
          module: input.module,
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
        return item;
      },
      updateItem: (id, updates) =>
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
          )
        }),
      deleteItem: (id) => {
        const items = get().items;
        const index = items.findIndex((item) => item.id === id);
        if (index < 0) {
          return null;
        }
        const item = items[index];
        set({ items: items.filter((entry) => entry.id !== id) });
        return { item, index };
      },
      restoreDeletedItem: ({ item, index }) => {
        const items = [...get().items];
        if (items.some((entry) => entry.id === item.id)) {
          return;
        }
        items.splice(Math.min(index, items.length), 0, item);
        set({ items });
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
      clearWorkspace: () => set({ items: [], dashboardOrder: [], dashboardVisibleIds: [] })
    }),
    {
      name: "dashy-workspace-v1",
      partialize: (state) => ({
        items: state.items,
        theme: state.theme,
        dashboardOrder: state.dashboardOrder,
        dashboardVisibleIds: state.dashboardVisibleIds
      })
    }
  )
);
