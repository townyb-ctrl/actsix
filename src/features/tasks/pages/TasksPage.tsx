import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Inbox,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import TaskEditorModal from "@/components/TaskEditorModal";
import CompactTaskRow from "@/components/CompactTaskRow";
import { syncProjectStatsById, syncProjectStatsForIds } from "@/lib/syncProjectStats";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { personalNextActionFilter } from "@/lib/taskVisibility";
import { QuickCaptureDialog } from "@/components/QuickCaptureDialog";

const priorityWeight: Record<string, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const parseLocalDate = (value?: string | null) => {
  if (!value) return null;

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;

  return new Date(year, month - 1, day);
};

const isToday = (value?: string | null) => {
  const due = parseLocalDate(value);
  if (!due) return false;

  const today = startOfToday();
  return due.getTime() === today.getTime();
};

const isThisWeek = (value?: string | null) => {
  const due = parseLocalDate(value);
  if (!due) return false;

  const today = startOfToday();
  const end = new Date(today);
  end.setDate(today.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return due >= today && due <= end;
};

const isOverdue = (value?: string | null) => {
  const due = parseLocalDate(value);
  if (!due) return false;

  return due < startOfToday();
};

const TasksPage = () => {
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();

  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [dateView, setDateView] = useState("all");
  const [projectFilter, setProjectFilter] = useState("All");
  const [contextFilter, setContextFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [energyFilter, setEnergyFilter] = useState("All");
  const [sortBy, setSortBy] = useState("due");

  const load = async () => {
    if (!user) {
      setLoadingTasks(false);
      return;
    }

    setLoadingTasks(true);

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .or(personalNextActionFilter(currentPerson?.id))
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoadingTasks(false);
      return;
    }

    setTasks(data ?? []);
    setLoadingTasks(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user, currentPerson?.id]);

  const uniqueProjects = useMemo(() => {
    return Array.from(
      new Set(tasks.map((task) => task.project).filter(Boolean))
    ).sort();
  }, [tasks]);

  const uniqueContexts = useMemo(() => {
    return Array.from(
      new Set(tasks.map((task) => task.context || "General").filter(Boolean))
    ).sort();
  }, [tasks]);

  const uniquePriorities = useMemo(() => {
    return Array.from(
      new Set(tasks.map((task) => task.priority || "Medium").filter(Boolean))
    ).sort((a, b) => (priorityWeight[b] || 0) - (priorityWeight[a] || 0));
  }, [tasks]);

  const uniqueEnergies = useMemo(() => {
    return Array.from(
      new Set(tasks.map((task) => task.energy || "Medium").filter(Boolean))
    ).sort();
  }, [tasks]);

  const hasActiveFilters =
    Boolean(search.trim()) ||
    dateView !== "all" ||
    projectFilter !== "All" ||
    contextFilter !== "All" ||
    priorityFilter !== "All" ||
    energyFilter !== "All" ||
    sortBy !== "due";

  const clearFilters = () => {
    setSearch("");
    setDateView("all");
    setProjectFilter("All");
    setContextFilter("All");
    setPriorityFilter("All");
    setEnergyFilter("All");
    setSortBy("due");
  };

  const matchesDateView = (task: any) => {
    if (dateView === "today") return isToday(task.due);
    if (dateView === "week") return isThisWeek(task.due);
    if (dateView === "nodate") return !task.due;
    if (dateView === "overdue") return isOverdue(task.due);
    return true;
  };

  const applyFiltersAndSort = (source: any[]) => {
    const q = search.trim().toLowerCase();

    const filtered = source.filter((task) => {
      const matchesSearch =
        !q ||
        (task.title || "").toLowerCase().includes(q) ||
        (task.notes || "").toLowerCase().includes(q) ||
        (task.project || "").toLowerCase().includes(q) ||
        (task.context || "").toLowerCase().includes(q);

      const matchesProject =
        projectFilter === "All" || (task.project || "") === projectFilter;

      const matchesContext =
        contextFilter === "All" || (task.context || "General") === contextFilter;

      const matchesPriority =
        priorityFilter === "All" || (task.priority || "Medium") === priorityFilter;

      const matchesEnergy =
        energyFilter === "All" || (task.energy || "Medium") === energyFilter;

      return (
        matchesSearch &&
        matchesDateView(task) &&
        matchesProject &&
        matchesContext &&
        matchesPriority &&
        matchesEnergy
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "priority") {
        return (
          (priorityWeight[b.priority || "Medium"] || 0) -
          (priorityWeight[a.priority || "Medium"] || 0)
        );
      }

      if (sortBy === "newest") {
        return (
          new Date(b.created_at || 0).getTime() -
          new Date(a.created_at || 0).getTime()
        );
      }

      if (sortBy === "oldest") {
        return (
          new Date(a.created_at || 0).getTime() -
          new Date(b.created_at || 0).getTime()
        );
      }

      if (sortBy === "duration") {
        return (a.minutes || 15) - (b.minutes || 15);
      }

      const aDue = a.due
        ? parseLocalDate(a.due)?.getTime() ?? Number.POSITIVE_INFINITY
        : Number.POSITIVE_INFINITY;

      const bDue = b.due
        ? parseLocalDate(b.due)?.getTime() ?? Number.POSITIVE_INFINITY
        : Number.POSITIVE_INFINITY;

      return aDue - bDue;
    });
  };

  const toggle = async (task: any) => {
    const nextComplete = !task.complete;

    const { error } = await supabase
      .from("tasks")
      .update({
        complete: nextComplete,
        completed_at: nextComplete ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsById(task.project_id);
    load();
  };

  const remove = async (taskOrId: any) => {
    const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
    const targetTask = tasks.find((task) => task.id === id);

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsById(targetTask?.project_id);
    toast.success("Task deleted");
    load();
  };

  const saveTask = async () => {
    if (!editingTask) return;

    const previousTask = tasks.find((task) => task.id === editingTask.id);

    setSaving(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        title: editingTask.title || "",
        notes: editingTask.notes || "",
        project: editingTask.project || "",
        project_id: editingTask.project_id || null,
        context: editingTask.context || "General",
        priority: editingTask.priority || "Medium",
        energy: editingTask.energy || "Medium",
        minutes: Number(editingTask.minutes) || 15,
        due: editingTask.due || null,
        tags: Array.isArray(editingTask.tags) ? editingTask.tags : [],
        assigned_person_id: editingTask.assigned_person_id || null,
        complete: Boolean(editingTask.complete),
        completed_at: editingTask.complete
          ? editingTask.completed_at || new Date().toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingTask.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStatsForIds([previousTask?.project_id, editingTask.project_id]);
    toast.success("Task updated");
    setEditingTask(null);
    load();
  };

  const open = tasks.filter((task) => !task.complete);
  const done = tasks.filter((task) => task.complete);

  const filteredOpen = applyFiltersAndSort(open);
  const filteredDone = applyFiltersAndSort(done);

  const dateViews = [
    { value: "all", label: "All", count: open.length },
    { value: "today", label: "Today", count: open.filter((task) => isToday(task.due)).length },
    { value: "week", label: "This Week", count: open.filter((task) => isThisWeek(task.due)).length },
    { value: "nodate", label: "No Date", count: open.filter((task) => !task.due).length },
    { value: "overdue", label: "Overdue", count: open.filter((task) => isOverdue(task.due)).length },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Workflow"
        title="Next Actions"
        subtitle="The next thing to do, in any context."
        actions={
          <>
            <div className="actsix-search-field sm:w-48 lg:w-56">
              <Search className="actsix-search-icon" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search next actions..."
                className="actsix-search-input"
              />
            </div>

            <Button
              variant="outline"
              className={`actsix-btn-outline h-9 min-h-9 gap-1.5 px-2.5 text-xs ${
                hasActiveFilters
                  ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/15 hover:text-brand-teal"
                  : ""
              }`}
              onClick={() => setShowFilters((value) => !value)}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Filters
              {hasActiveFilters && (
                <span className="ml-1 rounded-full bg-brand-teal/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-teal">
                  On
                </span>
              )}
            </Button>
          </>
        }
      />

      <div className="-mt-1 w-full space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        {!loadingTasks && tasks.length === 0 && (
          <Card
            data-tour="tasks-gtd-primer"
            className="actsix-panel-soft overflow-hidden border-brand-teal/20"
          >
            <div className="grid gap-px bg-border/70 md:grid-cols-[minmax(0,1fr)_minmax(20rem,0.55fr)]">
              <div className="bg-background/70 p-4 md:p-5">
                <p className="label-eyebrow">GTD Starter</p>
                <h2 className="mt-1.5 text-xl font-extrabold tracking-tight">
                  Build your trusted task system
                </h2>
                <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-muted-foreground">
                  GTD starts by capturing what has your attention, then clarifying it into the next physical action. ACTSIX keeps raw thoughts in Inbox and keeps actionable work here in Next Actions.
                </p>

                <div data-tour="tasks-clarify" className="mt-4 grid gap-3 sm:grid-cols-3">
                  {[
                    ["Capture", "Put the thought somewhere trusted."],
                    ["Clarify", "Decide the next visible action."],
                    ["Engage", "Work from context, time, energy, and priority."],
                  ].map(([title, body]) => (
                    <div key={title} className="rounded-xl border border-border/70 bg-background/70 p-3">
                      <p className="text-sm font-extrabold">{title}</p>
                      <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">{body}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col justify-between bg-brand-teal/5 p-4 md:p-5">
                <div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <h3 className="mt-3 text-lg font-extrabold">Add your first task</h3>
                  <p className="mt-1 text-sm font-semibold leading-6 text-muted-foreground">
                    Start with one real thing. You can clean it up later.
                  </p>
                </div>

                <Button
                  type="button"
                  data-tour="tasks-first-capture"
                  className="actsix-btn-primary mt-4"
                  onClick={() => setQuickCaptureOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Capture first task
                </Button>
              </div>
            </div>
          </Card>
        )}

        <div data-tour="tasks-filters" className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="truncate">Showing {filteredOpen.length} of {open.length} open actions
              {hasActiveFilters ? " with filters applied" : ""}
            </span>
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 self-start px-2.5 text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground sm:self-auto"
              onClick={clearFilters}
            >
              <X className="mr-1.5 h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>

        <div className="actsix-filter-pills">
            {dateViews.map((view) => {
              const active = dateView === view.value;

              return (
                <button
                  key={view.value}
                  type="button"
                  onClick={() => setDateView(view.value)}
                  className={`actsix-filter-pill ${
                    active
                      ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                      : "border-border/70 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  {view.label}
                  <span
                    className={`actsix-filter-pill-count ${
                      active
                        ? "bg-brand-teal/15 text-brand-teal"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {view.count}
                  </span>
                </button>
              );
            })}
        </div>

        {showFilters && (
          <Card className="actsix-panel-soft p-4 sm:p-5">
            <div className="grid md:grid-cols-5 gap-2">
              <div>
                <label className="label-eyebrow flex h-4 items-center">Project</label>
                <select
                  value={projectFilter}
                  onChange={(event) => setProjectFilter(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                >
                  <option>All</option>
                  {uniqueProjects.map((project) => (
                    <option key={project}>{project}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-eyebrow flex h-4 items-center">Context</label>
                <select
                  value={contextFilter}
                  onChange={(event) => setContextFilter(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                >
                  <option>All</option>
                  {uniqueContexts.map((context) => (
                    <option key={context}>{context}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-eyebrow flex h-4 items-center">Priority</label>
                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                >
                  <option>All</option>
                  {uniquePriorities.map((priority) => (
                    <option key={priority}>{priority}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-eyebrow flex h-4 items-center">Energy</label>
                <select
                  value={energyFilter}
                  onChange={(event) => setEnergyFilter(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                >
                  <option>All</option>
                  {uniqueEnergies.map((energy) => (
                    <option key={energy}>{energy}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-eyebrow flex h-4 items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" />
                  Sort
                </label>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                >
                  <option value="due">Due date</option>
                  <option value="priority">Priority</option>
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="duration">Shortest duration</option>
                </select>
              </div>
            </div>
          </Card>
        )}

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold tracking-tight">
              Open
              <span className="ml-2 rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs font-extrabold text-muted-foreground">
                {filteredOpen.length}
              </span>
            </h2>
          </div>

          <Card data-tour="tasks-list" className="actsix-panel space-y-1.5 p-2">
            {loadingTasks && (
              <div className="actsix-loading-state">
                Loading next actions...
              </div>
            )}

            {!loadingTasks && filteredOpen.length === 0 && (
              <div className="actsix-empty-state">
                No open actions match this view.
              </div>
            )}

            {filteredOpen.map((task) => (
              <CompactTaskRow
                key={task.id}
                task={task}
                onToggle={toggle}
                onEdit={(task) => setEditingTask({ ...task })}
                onDelete={remove}
              />
            ))}
          </Card>
        </section>

        {done.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowCompleted((value) => !value)}
              className="mb-2 flex min-h-10 w-full items-center justify-between gap-2.5 rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-left transition hover:border-brand-teal/30 hover:bg-brand-teal/5"
            >
              <div className="flex items-center gap-2">
                {showCompleted ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}

                <h2 className="text-lg font-extrabold tracking-tight text-muted-foreground">
                  Completed
                  <span className="ml-2 rounded-full border border-border/70 bg-background px-2 py-0.5 text-xs font-extrabold text-muted-foreground">
                    {filteredDone.length}
                  </span>
                </h2>
              </div>

              <span className="text-xs font-bold text-muted-foreground">
                {showCompleted ? "Collapse" : "Expand"}
              </span>
            </button>

            {showCompleted && (
              <Card className="actsix-panel-soft space-y-1.5 p-2 opacity-90">
                {filteredDone.length === 0 && (
                  <div className="actsix-empty-state">
                    No completed actions match this view.
                  </div>
                )}

                {filteredDone.map((task) => (
                  <CompactTaskRow
                    key={task.id}
                    task={task}
                    onToggle={toggle}
                    onEdit={(task) => setEditingTask({ ...task })}
                    onDelete={remove}
                  />
                ))}
              </Card>
            )}
          </section>
        )}
      </div>

      <TaskEditorModal
        task={editingTask}
        saving={saving}
        eyebrow="Edit Next Action"
        description="Select a project and context from your ACTSIX lists."
        onChange={setEditingTask}
        onClose={() => setEditingTask(null)}
        onSave={saveTask}
        onDelete={
          editingTask
            ? () => {
                remove(editingTask.id);
                setEditingTask(null);
              }
            : undefined
        }
        onRefreshOptions={load}
      />
      <QuickCaptureDialog
        open={quickCaptureOpen}
        onOpenChange={(open) => {
          setQuickCaptureOpen(open);
          if (!open) load();
        }}
      />
    </div>
  );
};

export default TasksPage;
