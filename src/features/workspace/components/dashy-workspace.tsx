"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import type { DragEndEvent } from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Activity,
  Archive,
  ArchiveRestore,
  ArrowRight,
  BarChart3,
  BookOpen,
  Brain,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  Circle,
  CircleDollarSign,
  Command,
  Contact,
  FileText,
  FolderKanban,
  GraduationCap,
  GripVertical,
  Home,
  Lightbulb,
  Lock,
  Menu,
  Moon,
  NotebookTabs,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Target,
  Trash2,
  Users,
  X,
  Zap
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "sonner";
import { modules, priorityRank } from "../data";
import { quickCaptureSchema } from "../schema";
import { hasPasscode } from "../security";
import { useWorkspaceStore } from "../store";
import type { ItemStatus, ModuleKey, Priority, WorkspaceItem } from "../types";
import { cn } from "@/shared/lib/utils";
import { LockScreen } from "./lock-screen";
import { SettingsPage } from "./settings-page";

const moduleIcons: Record<ModuleKey, LucideIcon> = {
  dashboard: Home,
  projects: FolderKanban,
  tasks: CheckSquare,
  calendar: CalendarDays,
  knowledge: Brain,
  notes: NotebookTabs,
  ideas: Lightbulb,
  documents: FileText,
  learning: GraduationCap,
  goals: Target,
  habits: Activity,
  journal: BookOpen,
  finance: CircleDollarSign,
  crm: Users,
  school: Building2,
  ngo: Sparkles,
  contacts: Contact,
  analytics: BarChart3,
  settings: Settings
};

const statusOptions: ItemStatus[] = ["idea", "planned", "active", "waiting", "done", "archived"];
const priorityOptions: Priority[] = ["low", "medium", "high", "urgent"];

const localDateString = (date = new Date()) => date.toLocaleDateString("en-CA");

type CaptureDraft = {
  title: string;
  description: string;
  module: ModuleKey;
  priority: Priority;
  dueDate: string;
};

type PaletteAction = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  keywords: string;
  run: () => void;
};

export function DashyWorkspace({ module }: { module: ModuleKey }) {
  const router = useRouter();
  const store = useWorkspaceStore();
  const [clock, setClock] = useState(new Date());
  const [customizing, setCustomizing] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);
  const [pinEnabled, setPinEnabled] = useState(false);
  const [draft, setDraft] = useState<CaptureDraft>({
    title: "",
    description: "",
    module: module === "dashboard" ? "tasks" : module,
    priority: "medium",
    dueDate: ""
  });

  useEffect(() => {
    setPinEnabled(hasPasscode());
    setLockChecked(true);
  }, []);

  useEffect(() => {
    store.setActiveModule(module);
  }, [module, store.setActiveModule]);

  useEffect(() => {
    const interval = window.setInterval(() => setClock(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark =
        store.theme === "dark" ||
        (store.theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      root.classList.toggle("dark", dark);
    };
    apply();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [store.theme]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        store.setCommandOpen(true);
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "Space") {
        event.preventDefault();
        store.setCaptureOpen(true);
      }
      if (event.key === "Escape") {
        store.setCommandOpen(false);
        store.setCaptureOpen(false);
        setCustomizing(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store.setCaptureOpen, store.setCommandOpen]);

  useEffect(() => {
    if (!store.timerRunning) return;
    const interval = window.setInterval(() => {
      store.tickTimer();
      if (useWorkspaceStore.getState().timerSeconds === 0) {
        toast.success("Focus session complete");
      }
    }, 1000);
    return () => window.clearInterval(interval);
  }, [store.timerRunning, store.tickTimer]);

  const activeItems = useMemo(
    () =>
      store.items
        .filter((item) => item.status !== "archived")
        .filter((item) => {
          const query = store.query.trim().toLowerCase();
          return (
            !query ||
            [item.title, item.description, item.module, item.priority, ...item.tags]
              .join(" ")
              .toLowerCase()
              .includes(query)
          );
        })
        .sort((a, b) => priorityRank[b.priority] - priorityRank[a.priority]),
    [store.items, store.query]
  );
  const definition = modules.find((item) => item.key === module) ?? modules[0];
  const moduleItems = activeItems.filter((item) => item.module === module);
  const archivedItems = store.items.filter((item) => item.status === "archived");
  const ongoingItems = activeItems.filter((item) => item.status === "active" || item.status === "planned");
  const dashboardItems = [...ongoingItems].sort((a, b) => {
    const aIndex = store.dashboardOrder.indexOf(a.id);
    const bIndex = store.dashboardOrder.indexOf(b.id);
    return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) - (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
  }).filter((item) => store.dashboardVisibleIds.includes(item.id));

  const createFromDraft = () => {
    const parsed = quickCaptureSchema.safeParse({
      module: draft.module,
      title: draft.title,
      description: draft.description || undefined,
      priority: draft.priority,
      dueDate: draft.dueDate || undefined,
      tags: []
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check the form and try again");
      return;
    }
    const item = store.createItem(parsed.data);
    setDraft({ title: "", description: "", module: draft.module, priority: "medium", dueDate: "" });
    store.setCaptureOpen(false);
    toast.success("Added to Dashy");
    router.push(`/${item.module}`);
  };

  const deleteWithUndo = (id: string) => {
    const removed = store.deleteItem(id);
    if (!removed) return;
    toast(`Deleted "${removed.item.title}"`, {
      action: { label: "Undo", onClick: () => store.restoreDeletedItem(removed) }
    });
  };

  const archiveWithUndo = (id: string) => {
    store.archiveItem(id);
    toast("Archived", {
      action: { label: "Undo", onClick: () => store.restoreItem(id) }
    });
  };

  const lockWorkspace = () => {
    if (hasPasscode()) {
      setPinEnabled(true);
      store.setUnlocked(false);
    } else {
      toast.info("Set a passcode in Settings to lock Dashy");
      router.push("/settings");
    }
  };

  const paletteActions: PaletteAction[] = [
    {
      id: "new-item",
      label: "New item",
      hint: "Quick capture",
      icon: Plus,
      keywords: "new add create task capture",
      run: () => store.setCaptureOpen(true)
    },
    {
      id: "toggle-timer",
      label: store.timerRunning ? "Pause focus timer" : "Start focus timer",
      hint: "25 minute session",
      icon: store.timerRunning ? Pause : Play,
      keywords: "timer focus pomodoro start pause",
      run: () => store.setTimerRunning(!store.timerRunning)
    },
    {
      id: "focus-mode",
      label: "Enter focus mode",
      hint: "One task, no dashboard",
      icon: Target,
      keywords: "focus mode zen distraction",
      run: () => store.setFocusMode(true)
    },
    {
      id: "toggle-theme",
      label: "Switch theme",
      hint: `Now: ${store.theme}`,
      icon: store.theme === "dark" ? Sun : Moon,
      keywords: "theme dark light mode appearance",
      run: () => store.setTheme(store.theme === "light" ? "dark" : store.theme === "dark" ? "system" : "light")
    },
    {
      id: "lock",
      label: "Lock workspace",
      hint: pinEnabled ? "Requires passcode to reopen" : "Set a passcode first",
      icon: Lock,
      keywords: "lock security passcode pin",
      run: lockWorkspace
    },
    ...modules.map((entry) => ({
      id: `go-${entry.key}`,
      label: `Go to ${entry.label}`,
      hint: entry.description,
      icon: moduleIcons[entry.key],
      keywords: `go open ${entry.label} ${entry.key}`,
      run: () => router.push(entry.key === "dashboard" ? "/" : `/${entry.key}`)
    }))
  ];

  if (!lockChecked) {
    return null;
  }

  if (pinEnabled && !store.unlocked) {
    return <LockScreen onUnlock={() => store.setUnlocked(true)} />;
  }

  if (store.focusMode) {
    const focusItem = activeItems.find((item) => item.status !== "done");
    return (
      <main className="focus-stage">
        <Toaster richColors position="top-right" />
        <div className="focus-stage__bar">
          <IconButton label="Exit focus" onClick={() => store.setFocusMode(false)}>
            <ChevronLeft />
          </IconButton>
          <Timer seconds={store.timerSeconds} />
        </div>
        <section className="focus-stage__content">
          <p className="eyebrow">Current focus</p>
          <h1>{focusItem?.title ?? "Choose one clear priority"}</h1>
          <p>{focusItem?.description || "Add a task, then return here to work without the surrounding dashboard."}</p>
          {focusItem ? (
            <input
              aria-label="Task progress"
              max={100}
              min={0}
              type="range"
              value={focusItem.progress}
              onChange={(event) => store.updateItem(focusItem.id, { progress: Number(event.target.value) })}
            />
          ) : null}
        </section>
        <TimerControls
          running={store.timerRunning}
          onReset={store.resetTimer}
          onToggle={() => store.setTimerRunning(!store.timerRunning)}
        />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Toaster richColors position="top-right" />
      <Sidebar module={module} />
      <div className="app-main">
        <Topbar onLock={lockWorkspace} />
        <div className="page-wrap" id="main-content">
          {module === "dashboard" ? (
            <Dashboard
              clock={clock}
              items={activeItems}
              dashboardItems={dashboardItems}
              ongoingItems={ongoingItems}
              customizing={customizing}
              onCustomize={() => setCustomizing(true)}
              onReorder={store.reorderDashboardItem}
              onUpdate={store.updateItem}
              onFocus={() => store.setFocusMode(true)}
            />
          ) : module === "settings" ? (
            <>
              <ModuleHeader definition={definition} />
              <SettingsPage />
            </>
          ) : (
            <ModulePage
              definition={definition}
              items={moduleItems}
              archivedItems={archivedItems}
              onCapture={() => {
                setDraft((value) => ({ ...value, module }));
                store.setCaptureOpen(true);
              }}
              onUpdate={store.updateItem}
              onArchive={archiveWithUndo}
              onDelete={deleteWithUndo}
              onRestore={store.restoreItem}
            />
          )}
        </div>
      </div>
      <CustomizePanel
        open={customizing}
        items={ongoingItems}
        visibleIds={store.dashboardVisibleIds}
        onClose={() => setCustomizing(false)}
        onToggle={store.toggleDashboardItem}
      />
      <CaptureDialog
        open={store.captureOpen}
        draft={draft}
        onChange={setDraft}
        onClose={() => store.setCaptureOpen(false)}
        onCreate={createFromDraft}
      />
      <CommandPalette
        open={store.commandOpen}
        items={activeItems}
        actions={paletteActions}
        onClose={() => store.setCommandOpen(false)}
        onSelect={(item) => {
          store.setCommandOpen(false);
          router.push(`/${item.module}`);
        }}
      />
    </main>
  );
}

function Sidebar({ module }: { module: ModuleKey }) {
  const { items, sidebarOpen, setSidebarOpen } = useWorkspaceStore();
  const closeOnMobile = () => {
    if (window.innerWidth <= 780) {
      setSidebarOpen(false);
    }
  };
  return (
    <>
      <aside className={cn("sidebar", sidebarOpen ? "sidebar--open" : "sidebar--closed")}>
        <div className="brand-row">
          <Link className="brand" href="/" onClick={closeOnMobile}>
            <span className="brand__mark">D</span>
            {sidebarOpen ? <strong>Dashy</strong> : null}
          </Link>
          <IconButton label="Toggle sidebar" className="desktop-only" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
          </IconButton>
        </div>
        <nav className="sidebar__nav" aria-label="Workspace">
          {modules.map((item) => {
            const Icon = moduleIcons[item.key];
            const count = items.filter((entry) => entry.module === item.key && entry.status !== "archived").length;
            return (
              <Link
                href={item.key === "dashboard" ? "/" : `/${item.key}`}
                key={item.key}
                className={cn("nav-link", module === item.key && "nav-link--active")}
                title={!sidebarOpen ? item.label : undefined}
                onClick={closeOnMobile}
              >
                <Icon />
                {sidebarOpen ? <><span>{item.label}</span>{count ? <small>{count}</small> : null}</> : null}
              </Link>
            );
          })}
        </nav>
      </aside>
      {sidebarOpen ? <button className="sidebar-scrim" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)} /> : null}
    </>
  );
}

function Topbar({ onLock }: { onLock: () => void }) {
  const store = useWorkspaceStore();
  const nextTheme = store.theme === "light" ? "dark" : store.theme === "dark" ? "system" : "light";
  return (
    <header className="topbar">
      <IconButton label="Open sidebar" className="mobile-only" onClick={() => store.setSidebarOpen(true)}><Menu /></IconButton>
      <button className="search-command" onClick={() => store.setCommandOpen(true)}>
        <Search />
        <span>Search or run a command</span>
        <kbd>Ctrl K</kbd>
      </button>
      <div className="topbar__actions">
        <IconButton label="Lock workspace" onClick={onLock}><Lock /></IconButton>
        <IconButton label={`Theme: ${store.theme}`} onClick={() => store.setTheme(nextTheme)}>
          {store.theme === "dark" ? <Moon /> : store.theme === "light" ? <Sun /> : <Settings />}
        </IconButton>
        <button className="primary-button" onClick={() => store.setCaptureOpen(true)}><Plus /> Add</button>
      </div>
    </header>
  );
}

function Dashboard({
  clock,
  items,
  dashboardItems,
  ongoingItems,
  customizing,
  onCustomize,
  onReorder,
  onUpdate,
  onFocus
}: {
  clock: Date;
  items: WorkspaceItem[];
  dashboardItems: WorkspaceItem[];
  ongoingItems: WorkspaceItem[];
  customizing: boolean;
  onCustomize: () => void;
  onReorder: (activeId: string, overId: string) => void;
  onUpdate: (id: string, updates: Partial<WorkspaceItem>) => void;
  onFocus: () => void;
}) {
  const store = useWorkspaceStore();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const done = items.filter((item) => item.status === "done").length;
  const urgent = items.filter((item) => item.priority === "urgent" && item.status !== "done").length;
  const today = localDateString();
  const overdue = items.filter((item) => item.dueDate && item.dueDate < today && item.status !== "done").length;
  const date = clock.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <>
      <section className="dashboard-intro">
        <div>
          <p className="eyebrow">{date}</p>
          <h1>Keep the important work in view.</h1>
          <p className="lede">{ongoingItems.length} active threads across your workspace. Arrange this page around what needs attention now.</p>
        </div>
        <button className="secondary-button" onClick={onCustomize} aria-expanded={customizing}>
          <SlidersHorizontal /> Customize
        </button>
      </section>

      <section className="signal-strip" aria-label="Workspace summary">
        <Signal value={ongoingItems.length} label="Ongoing" note="in motion" />
        <Signal value={urgent} label="Urgent" note="needs a decision" tone={urgent ? "danger" : undefined} />
        <Signal value={overdue} label="Overdue" note="past due date" tone={overdue ? "danger" : undefined} />
        <Signal value={done} label="Completed" note="all time" />
      </section>

      <div className="dashboard-grid">
        <section className="work-board">
          <div className="section-heading">
            <div><p className="eyebrow">Pinned work</p><h2>Your operating queue</h2></div>
            <span>{dashboardItems.length} shown</span>
          </div>
          <div className="work-list">
            {dashboardItems.length ? (
              <DndContext
                collisionDetection={closestCenter}
                sensors={sensors}
                onDragEnd={(event: DragEndEvent) => {
                  if (event.over) onReorder(String(event.active.id), String(event.over.id));
                }}
              >
                <SortableContext items={dashboardItems.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                  {dashboardItems.map((item, index) => (
                    <SortableWorkRow item={item} index={index} key={item.id} onUpdate={onUpdate} />
                  ))}
                </SortableContext>
              </DndContext>
            ) : (
              <EmptyState title="Build your dashboard" text="Choose ongoing projects and tasks to keep them visible here." action="Choose work" onAction={onCustomize} />
            )}
          </div>
        </section>

        <aside className="dashboard-rail">
          <section className="focus-panel">
            <div><p className="eyebrow">Focus timer</p><Timer seconds={store.timerSeconds} /></div>
            <p>Protect one block of time for the work at the top of your queue.</p>
            <TimerControls
              running={store.timerRunning}
              onReset={store.resetTimer}
              onToggle={() => store.setTimerRunning(!store.timerRunning)}
            />
            <button className="text-button" onClick={onFocus}>Enter focus mode <ArrowRight /></button>
          </section>
          <section className="today-panel">
            <div className="section-heading"><div><p className="eyebrow">Next up</p><h2>Due soon</h2></div></div>
            {items
              .filter((item) => item.dueDate && item.status !== "done")
              .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
              .slice(0, 4)
              .map((item) => (
                <Link className={cn("due-row", item.dueDate && item.dueDate < today && "due-row--overdue")} href={`/${item.module}`} key={item.id}>
                  <span>{new Date(`${item.dueDate}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                  <strong>{item.title}</strong>
                  <ArrowRight />
                </Link>
              ))}
          </section>
        </aside>
      </div>
    </>
  );
}

function SortableWorkRow({
  item,
  index,
  onUpdate
}: {
  item: WorkspaceItem;
  index: number;
  onUpdate: (id: string, updates: Partial<WorkspaceItem>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });
  return (
    <article
      className={cn("work-row", isDragging && "work-row--dragging")}
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <button
        className="drag-handle"
        aria-label={`Drag ${item.title}`}
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical />
      </button>
      <span className="work-index">{String(index + 1).padStart(2, "0")}</span>
      <div className="work-row__body">
        <div className="work-row__top">
          <div><span className="module-label">{item.module}</span><h3>{item.title}</h3></div>
          <span className={cn("priority", `priority--${item.priority}`)}>{item.priority}</span>
        </div>
        <p>{item.description}</p>
        <div className="progress-line"><span style={{ width: `${item.progress}%` }} /></div>
        <div className="work-row__meta">
          <span>{item.progress}% complete</span>
          <select value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value as ItemStatus })}>
            {statusOptions.map((status) => <option key={status}>{status}</option>)}
          </select>
        </div>
      </div>
    </article>
  );
}

function ModuleHeader({ definition }: { definition: (typeof modules)[number] }) {
  const Icon = moduleIcons[definition.key];
  return (
    <section className="module-header">
      <div className="module-header__icon"><Icon /></div>
      <div><p className="eyebrow">Workspace / {definition.label}</p><h1>{definition.label}</h1><p>{definition.description}</p></div>
    </section>
  );
}

function ModulePage({
  definition,
  items,
  archivedItems,
  onCapture,
  onUpdate,
  onArchive,
  onDelete,
  onRestore
}: {
  definition: (typeof modules)[number];
  items: WorkspaceItem[];
  archivedItems: WorkspaceItem[];
  onCapture: () => void;
  onUpdate: (id: string, updates: Partial<WorkspaceItem>) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onRestore: (id: string) => void;
}) {
  const Icon = moduleIcons[definition.key];
  const archivedForModule = archivedItems.filter((item) => item.module === definition.key);
  const today = localDateString();
  const groups =
    definition.key === "tasks"
      ? [
          { key: "overdue", label: "Overdue", items: items.filter((item) => item.status !== "done" && item.dueDate && item.dueDate < today) },
          { key: "today", label: "Today", items: items.filter((item) => item.status !== "done" && item.dueDate === today) },
          { key: "upcoming", label: "Upcoming", items: items.filter((item) => item.status !== "done" && item.dueDate && item.dueDate > today) },
          { key: "someday", label: "No date", items: items.filter((item) => item.status !== "done" && !item.dueDate) },
          { key: "done", label: "Completed", items: items.filter((item) => item.status === "done") }
        ].filter((group) => group.items.length)
      : null;

  return (
    <>
      <section className="module-header">
        <div className="module-header__icon"><Icon /></div>
        <div><p className="eyebrow">Workspace / {definition.label}</p><h1>{definition.label}</h1><p>{definition.description}</p></div>
        <button className="primary-button" onClick={onCapture}><Plus /> New item</button>
      </section>
      <section className="module-toolbar">
        <span>{items.length} active items</span>
        <span>{items.filter((item) => item.status === "done").length} completed</span>
      </section>
      {groups ? (
        groups.length ? (
          groups.map((group) => (
            <section className="task-group" key={group.key}>
              <div className="task-group__head">
                <h2 className={cn(group.key === "overdue" && "task-group__title--overdue")}>{group.label}</h2>
                <span>{group.items.length}</span>
              </div>
              <div className="item-grid">
                {group.items.map((item) => (
                  <ItemCard key={item.id} item={item} onUpdate={onUpdate} onArchive={onArchive} onDelete={onDelete} />
                ))}
              </div>
            </section>
          ))
        ) : (
          <section className="item-grid">
            <EmptyState title="No tasks yet" text="Capture the first task and it will show up grouped by due date." action="Add task" onAction={onCapture} />
          </section>
        )
      ) : (
        <section className="item-grid">
          {items.length ? items.map((item) => (
            <ItemCard key={item.id} item={item} onUpdate={onUpdate} onArchive={onArchive} onDelete={onDelete} />
          )) : <EmptyState title={`No ${definition.label.toLowerCase()} yet`} text="Capture the first item and it will stay available on this page." action="Add item" onAction={onCapture} />}
        </section>
      )}
      {archivedForModule.length ? (
        <section className="archive-section">
          <div className="section-heading"><div><p className="eyebrow">Archive</p><h2>Stored items</h2></div></div>
          {archivedForModule.map((item) => (
            <div className="archive-row" key={item.id}><span>{item.title}</span><IconButton label="Restore" onClick={() => onRestore(item.id)}><ArchiveRestore /></IconButton><IconButton label="Delete" onClick={() => onDelete(item.id)}><Trash2 /></IconButton></div>
          ))}
        </section>
      ) : null}
    </>
  );
}

function ItemCard({ item, onUpdate, onArchive, onDelete }: {
  item: WorkspaceItem;
  onUpdate: (id: string, updates: Partial<WorkspaceItem>) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const done = item.status === "done";
  const overdue = !done && item.dueDate && item.dueDate < localDateString();
  return (
    <article className={cn("item-card", done && "item-card--done")}>
      <div className="item-card__head">
        <div className="item-card__badges">
          <button
            className={cn("check-toggle", done && "check-toggle--done")}
            aria-label={done ? "Mark as not done" : "Mark as done"}
            title={done ? "Mark as not done" : "Mark as done"}
            onClick={() => onUpdate(item.id, done ? { status: "active" } : { status: "done", progress: 100 })}
          >
            {done ? <CheckCircle2 /> : <Circle />}
          </button>
          <span className={cn("priority", `priority--${item.priority}`)}>{item.priority}</span>
          {overdue ? <span className="overdue-badge">Overdue</span> : null}
        </div>
        <div><IconButton label="Archive" onClick={() => onArchive(item.id)}><Archive /></IconButton><IconButton label="Delete" onClick={() => onDelete(item.id)}><Trash2 /></IconButton></div>
      </div>
      <input className="title-input" value={item.title} onChange={(event) => onUpdate(item.id, { title: event.target.value })} />
      <textarea value={item.description} onChange={(event) => onUpdate(item.id, { description: event.target.value })} />
      <div className="progress-line"><span style={{ width: `${item.progress}%` }} /></div>
      <input aria-label="Progress" type="range" min={0} max={100} value={item.progress} onChange={(event) => onUpdate(item.id, { progress: Number(event.target.value) })} />
      <div className="item-card__controls">
        <select value={item.status} onChange={(event) => onUpdate(item.id, { status: event.target.value as ItemStatus })}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select>
        <select value={item.priority} onChange={(event) => onUpdate(item.id, { priority: event.target.value as Priority })}>{priorityOptions.map((priority) => <option key={priority}>{priority}</option>)}</select>
        <input aria-label="Due date" type="date" value={item.dueDate ?? ""} onChange={(event) => onUpdate(item.id, { dueDate: event.target.value || undefined })} />
      </div>
    </article>
  );
}

function CustomizePanel({ open, items, visibleIds, onClose, onToggle }: {
  open: boolean;
  items: WorkspaceItem[];
  visibleIds: string[];
  onClose: () => void;
  onToggle: (id: string) => void;
}) {
  return (
    <AnimatePresence>
      {open ? <>
        <motion.button className="drawer-scrim" aria-label="Close customize panel" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
        <motion.aside className="customize-drawer" initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }} transition={{ duration: 0.24 }}>
          <div className="drawer-head"><div><p className="eyebrow">Dashboard</p><h2>Choose visible work</h2></div><IconButton label="Close" onClick={onClose}><X /></IconButton></div>
          <p className="drawer-copy">Select ongoing items, then drag them into the order you want on the dashboard.</p>
          <div className="drawer-list">
            {items.map((item) => {
              const selected = visibleIds.includes(item.id);
              return <button className={cn("selection-row", selected && "selection-row--selected")} key={item.id} onClick={() => onToggle(item.id)}>
                <span className="selection-check">{selected ? <Check /> : null}</span>
                <span><strong>{item.title}</strong><small>{item.module} · {item.status}</small></span>
              </button>;
            })}
          </div>
        </motion.aside>
      </> : null}
    </AnimatePresence>
  );
}

function CaptureDialog({ open, draft, onChange, onClose, onCreate }: {
  open: boolean;
  draft: CaptureDraft;
  onChange: (draft: CaptureDraft) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return <AnimatePresence>{open ? <motion.div className="dialog-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
    <motion.section className="capture-dialog" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onMouseDown={(event) => event.stopPropagation()}>
      <div className="drawer-head"><div><p className="eyebrow">Quick capture</p><h2>Add to Dashy</h2></div><IconButton label="Close" onClick={onClose}><X /></IconButton></div>
      <label>Title<input autoFocus value={draft.title} onChange={(event) => onChange({ ...draft, title: event.target.value })} /></label>
      <label>Notes<textarea value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} /></label>
      <div className="form-grid">
        <label>Area<select value={draft.module} onChange={(event) => onChange({ ...draft, module: event.target.value as ModuleKey })}>{modules.filter((item) => item.key !== "dashboard").map((item) => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
        <label>Priority<select value={draft.priority} onChange={(event) => onChange({ ...draft, priority: event.target.value as Priority })}>{priorityOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <label>Due date<input type="date" value={draft.dueDate} onChange={(event) => onChange({ ...draft, dueDate: event.target.value })} /></label>
      <button className="primary-button primary-button--full" onClick={onCreate}><Plus /> Add item</button>
    </motion.section>
  </motion.div> : null}</AnimatePresence>;
}

function CommandPalette({ open, items, actions, onClose, onSelect }: {
  open: boolean;
  items: WorkspaceItem[];
  actions: PaletteAction[];
  onClose: () => void;
  onSelect: (item: WorkspaceItem) => void;
}) {
  const { query, setQuery } = useWorkspaceStore();
  const trimmed = query.trim().toLowerCase();
  const visibleActions = trimmed
    ? actions.filter((action) => `${action.label} ${action.keywords}`.toLowerCase().includes(trimmed)).slice(0, 6)
    : actions.slice(0, 4);
  return <AnimatePresence>{open ? <motion.div className="dialog-wrap dialog-wrap--top" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
    <motion.section className="command-dialog" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onMouseDown={(event) => event.stopPropagation()}>
      <div className="command-input"><Command /><input autoFocus placeholder="Search items or type a command" value={query} onChange={(event) => setQuery(event.target.value)} /><kbd>Esc</kbd></div>
      <div className="command-results">
        {visibleActions.length ? <p className="command-section-label">Commands</p> : null}
        {visibleActions.map((action) => (
          <button key={action.id} onClick={() => { onClose(); action.run(); }}>
            <span className="command-icon command-icon--action"><action.icon /></span>
            <span><strong>{action.label}</strong><small>{action.hint}</small></span>
            <ArrowRight />
          </button>
        ))}
        {items.length ? <p className="command-section-label">Items</p> : null}
        {items.slice(0, 10).map((item) => <button key={item.id} onClick={() => onSelect(item)}><span className="command-icon"><ModuleGlyph module={item.module} /></span><span><strong>{item.title}</strong><small>{item.module} · {item.priority}</small></span><ArrowRight /></button>)}
      </div>
    </motion.section>
  </motion.div> : null}</AnimatePresence>;
}

function ModuleGlyph({ module }: { module: ModuleKey }) {
  const Icon = moduleIcons[module];
  return <Icon />;
}

function Signal({ value, label, note, tone }: { value: string | number; label: string; note: string; tone?: "danger" }) {
  return <div className={cn("signal", tone === "danger" && "signal--danger")}><strong>{value}</strong><span>{label}</span><small>{note}</small></div>;
}

function Timer({ seconds }: { seconds: number }) {
  return <strong className="timer">{Math.floor(seconds / 60).toString().padStart(2, "0")}:{(seconds % 60).toString().padStart(2, "0")}</strong>;
}

function TimerControls({ running, onToggle, onReset }: { running: boolean; onToggle: () => void; onReset: () => void }) {
  return <div className="timer-controls"><button className="primary-button" onClick={onToggle}>{running ? <Pause /> : <Play />}{running ? "Pause" : "Start"}</button><IconButton label="Reset timer" onClick={onReset}><RotateCcw /></IconButton></div>;
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action: string; onAction: () => void }) {
  return <div className="empty-state"><span><Zap /></span><h3>{title}</h3><p>{text}</p><button className="secondary-button" onClick={onAction}>{action}</button></div>;
}

function IconButton({ label, children, className, onClick }: { label: string; children: ReactNode; className?: string; onClick?: () => void }) {
  return <button className={cn("icon-button", className)} aria-label={label} title={label} onClick={onClick}>{children}</button>;
}
