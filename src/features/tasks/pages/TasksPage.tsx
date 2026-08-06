import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Inbox,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import TaskEditorModal from "@/components/TaskEditorModal";
import CompactTaskRow from "@/components/CompactTaskRow";
import { syncProjectStatsById, syncProjectStatsForIds } from "@/lib/syncProjectStats";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { personalNextActionFilter } from "@/lib/taskVisibility";
import { QuickCaptureDialog } from "@/components/QuickCaptureDialog";
import { createNextRecurringTaskOnCompletion } from "@/features/tasks/api/recurringTasksApi";

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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [dateView, setDateView] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("All");

  const load = async ({ showLoading = false } = {}) => {
    if (!user) {
      setLoadingTasks(false);
      return;
    }

    if (showLoading) {
      setLoadingTasks(true);
    }
    setLoadError(null);

    const { data, error } = await supabase
      .from("tasks")
      .select("*, project_sections(name), recurring_task_templates(frequency, interval)")
      .or(personalNextActionFilter(currentPerson?.id))
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(friendlyErrorMessage(error));
      setLoadError(error.message);
      setLoadingTasks(false);
      return;
    }

    setTasks(data ?? []);
    setLoadingTasks(false);
  };

  useEffect(() => {
    if (user) load({ showLoading: true });
  }, [user, currentPerson?.id]);

  const uniquePriorities = useMemo(() => {
    return Array.from(
      new Set(tasks.map((task) => task.priority || "Medium").filter(Boolean))
    ).sort((a, b) => (priorityWeight[b] || 0) - (priorityWeight[a] || 0));
  }, [tasks]);

  const hasActiveFilters =
    Boolean(search.trim()) || dateView !== "all" || priorityFilter !== "All";

  const clearFilters = () => {
    setSearch("");
    setDateView("all");
    setPriorityFilter("All");
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

      const matchesPriority =
        priorityFilter === "All" || (task.priority || "Medium") === priorityFilter;

      return matchesSearch && matchesDateView(task) && matchesPriority;
    });

    return [...filtered].sort((a, b) => {
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
      toast.error(friendlyErrorMessage(error));
      return;
    }

    if (nextComplete) {
      try {
        const createdNext = await createNextRecurringTaskOnCompletion(task);
        if (createdNext) toast.success("Next recurring task created");
      } catch (recurringError: any) {
        toast.error(friendlyErrorMessage(recurringError, "Task completed, but the next recurring task was not created."));
      }
    }

    await syncProjectStatsById(task.project_id);
    load();
  };

  const remove = async (taskOrId: any) => {
    const id = typeof taskOrId === "string" ? taskOrId : taskOrId.id;
    const targetTask = tasks.find((task) => task.id === id);

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
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
      toast.error(friendlyErrorMessage(error));
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
      />

      <div className="-mt-1 w-full space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        {!loadingTasks && loadError && (
          <Card className="actsix-panel-soft flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <div className="text-lg font-extrabold tracking-tight">Couldn't load your next actions</div>
              <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{loadError}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              className="actsix-btn-outline min-h-10"
              onClick={() => load({ showLoading: true })}
            >
              Try again
            </Button>
          </Card>
        )}

        {!loadingTasks && !loadError && tasks.length === 0 && (
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
                  className="actsix-btn-primary min-h-10 mt-4"
                  onClick={() => setQuickCaptureOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Capture first task
                </Button>
              </div>
            </div>
          </Card>
        )}

        {!loadError && (
          <div
            data-tour="tasks-filters"
            className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="truncate">Showing {filteredOpen.length} of {open.length} open actions
              {hasActiveFilters ? " with filters applied" : ""}
            </span>
          </div>
        )}

        {!loadError && (
          <>
            <section>
              {/* The count lives in the "Showing X of Y" line above and in the
                  "All" pill, so a visible heading here would say it a third time.
                  Kept for screen readers to keep the section labelled. */}
              <h2 className="sr-only">Open next actions</h2>

              <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                {/* pl-2 lines the pills up with the task card's inner padding below */}
                <div className="actsix-filter-pills min-w-0 flex-1 pl-2">
                  {dateViews.map((view) => {
                    const active = dateView === view.value;

                    return (
                      <button
                        key={view.value}
                        type="button"
                        onClick={() => setDateView(view.value)}
                        className={`actsix-filter-pill ${
                          active
                            ? "actsix-filter-pill-active"
                            : "actsix-filter-pill-idle"
                        }`}
                      >
                        {view.label}
                        <span
                          className={`actsix-filter-pill-count ${
                            active
                              ? "actsix-filter-pill-count-active"
                              : "actsix-filter-pill-count-idle"
                          }`}
                        >
                          {view.count}
                        </span>
                      </button>
                    );
                  })}
                  <select
                    value={priorityFilter}
                    onChange={(event) => setPriorityFilter(event.target.value)}
                    aria-label="Filter by priority"
                    className={`actsix-filter-pill ${
                      priorityFilter !== "All"
                        ? "actsix-filter-pill-active"
                        : "actsix-filter-pill-idle"
                    }`}
                  >
                    <option value="All">Any priority</option>
                    {uniquePriorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {priority}
                      </option>
                    ))}
                  </select>

                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="actsix-filter-pill border-transparent bg-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                      Clear
                    </button>
                  )}
                </div>

                <div className="actsix-search-field shrink-0 sm:w-52 lg:w-64">
                  <Search className="actsix-search-icon" />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search next actions..."
                    className="actsix-search-input"
                    aria-label="Search next actions"
                  />
                </div>
              </div>

              <Card data-tour="tasks-list" className="actsix-panel space-y-1.5 p-2">
                {loadingTasks && (
                  <div className="actsix-loading-state">
                    Loading next actions...
                  </div>
                )}

                {!loadingTasks && filteredOpen.length === 0 && (
                  <div className="actsix-empty-state">
                    {hasActiveFilters
                      ? `No open actions match these filters${
                          open.length > 0 ? ` — ${open.length} are hidden` : ""
                        }. Clear them above to see everything.`
                      : "No open actions match this view."}
                  </div>
                )}

                {filteredOpen.map((task) => (
                  <CompactTaskRow
                    key={task.id}
                    task={task}
                    showNotes={false}
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
                        showNotes={false}
                        onToggle={toggle}
                        onEdit={(task) => setEditingTask({ ...task })}
                        onDelete={remove}
                      />
                    ))}
                  </Card>
                )}
              </section>
            )}
          </>
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
