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

const Tasks = () => {
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();

  const [tasks, setTasks] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [search, setSearch] = useState("");
  const [dateView, setDateView] = useState("all");
  const [projectFilter, setProjectFilter] = useState("All");
  const [contextFilter, setContextFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [energyFilter, setEnergyFilter] = useState("All");
  const [sortBy, setSortBy] = useState("due");

  const load = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .or(personalNextActionFilter(currentPerson?.id))
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setTasks(data ?? []);
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
      />

      <div className="-mt-1 w-full space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <div data-tour="tasks-filters" className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Showing {filteredOpen.length} of {open.length} open actions
              {hasActiveFilters ? " with filters applied" : ""}
            </div>

            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 rounded-xl text-muted-foreground hover:text-foreground"
                  onClick={clearFilters}
                >
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Clear
                </Button>
              )}

              <Button
                variant="outline"
                className={`h-9 rounded-xl gap-2 ${
                  hasActiveFilters
                    ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/15 hover:text-brand-teal"
                    : ""
                }`}
                onClick={() => setShowFilters((value) => !value)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                {hasActiveFilters && (
                  <span className="ml-1 rounded-full bg-brand-teal/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-teal">
                    On
                  </span>
                )}
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search next actions..."
              className="h-10 pl-10 border-border/70 bg-card shadow-soft"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {dateViews.map((view) => {
              const active = dateView === view.value;

              return (
                <button
                  key={view.value}
                  type="button"
                  onClick={() => setDateView(view.value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-bold transition-colors ${
                    active
                      ? "border-brand-teal/35 bg-brand-teal/10 text-brand-teal"
                      : "border-border/70 bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  }`}
                >
                  {view.label}
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
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
        </div>

        {showFilters && (
          <Card className="p-4 shadow-card border-border/70 bg-card">
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
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg font-extrabold tracking-tight">
              Open{" "}
              <span className="text-muted-foreground font-normal text-base">
                · {filteredOpen.length}
              </span>
            </h2>
          </div>

          <Card data-tour="tasks-list" className="p-2 space-y-1.5 shadow-card border-border/70 bg-card">
            {filteredOpen.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">
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
              className="w-full flex items-center justify-between mb-2 rounded-2xl border border-border/70 bg-card px-4 py-2.5 shadow-soft hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                {showCompleted ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}

                <h2 className="text-lg font-extrabold tracking-tight text-muted-foreground">
                  Completed{" "}
                  <span className="font-normal text-base">
                    · {filteredDone.length}
                  </span>
                </h2>
              </div>

              <span className="text-xs font-bold text-muted-foreground">
                {showCompleted ? "Collapse" : "Expand"}
              </span>
            </button>

            {showCompleted && (
              <Card className="p-2 space-y-1.5 shadow-card border-border/70 bg-card opacity-80">
                {filteredDone.length === 0 && (
                  <div className="p-6 text-sm text-muted-foreground">
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
    </div>
  );
};

export default Tasks;
