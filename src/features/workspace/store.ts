"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { seedItems } from "./data";
import type { ModuleKey, QuickCaptureInput, ThemeMode, WorkspaceItem } from "./types";

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
  setActiveModule: (module: ModuleKey) => void;
  setQuery: (query: string) => void;
  setFocusMode: (value: boolean) => void;
  setSidebarOpen: (value: boolean) => void;
  setCommandOpen: (value: boolean) => void;
  setCaptureOpen: (value: boolean) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleDashboardItem: (id: string) => void;
  reorderDashboardItem: (activeId: string, overId: string) => void;
  createItem: (input: QuickCaptureInput) => WorkspaceItem;
  updateItem: (id: string, updates: Partial<WorkspaceItem>) => void;
  deleteItem: (id: string) => void;
  archiveItem: (id: string) => void;
  restoreItem: (id: string) => void;
};

const uid = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `item-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

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
      dashboardOrder: seedItems
        .filter((item) => item.status === "active" || item.status === "planned")
        .map((item) => item.id),
      dashboardVisibleIds: seedItems
        .filter((item) => item.status === "active" || item.status === "planned")
        .slice(0, 4)
        .map((item) => item.id),
      setActiveModule: (module) => set({ activeModule: module }),
      setQuery: (query) => set({ query }),
      setFocusMode: (value) => set({ focusMode: value }),
      setSidebarOpen: (value) => set({ sidebarOpen: value }),
      setCommandOpen: (value) => set({ commandOpen: value }),
      setCaptureOpen: (value) => set({ captureOpen: value }),
      setTheme: (theme) => set({ theme }),
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
          dashboardOrder: [item.id, ...get().dashboardOrder]
        });
        return item;
      },
      updateItem: (id, updates) =>
        set({
          items: get().items.map((item) =>
            item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
          )
        }),
      deleteItem: (id) => set({ items: get().items.filter((item) => item.id !== id) }),
      archiveItem: (id) =>
        get().updateItem(id, {
          status: "archived"
        }),
      restoreItem: (id) =>
        get().updateItem(id, {
          status: "active"
        })
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
