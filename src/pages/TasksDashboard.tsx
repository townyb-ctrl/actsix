import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Clock,
  FolderKanban,
  Inbox,
  LayoutDashboard,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CompactTaskRow from "@/components/CompactTaskRow";
import TaskEditorModal from "@/components/TaskEditorModal";
import { QuickCaptureDialog } from "@/components/QuickCaptureDialog";
import { syncProjectStats, syncProjectStatsForNames } from "@/lib/syncProjectStats";
import { toast } from "sonner";

const priorityWeight: Record<string, number> = {
  Urgent: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const TasksDashboard = () => {
  const { user } = useAuth();

  const [counts, setCounts] = useState({
    inbox: 0,
    next: 0,
    projects: 0,
    waiting: 0,
    someday: 0,
  });

  const [tasks, setTasks] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [quickCaptureOpen, setQuickCaptureOpen] = useState(false);

  const load = async () => {
    if (!user) return;

    const [inbox, next, projects, waiting, someday, taskResult] =
      await Promise.all([
        supabase.from("inbox_items").select("id", { count: "exact", head: true }),
        supabase
          .from("tasks")
          .select("id", { count: "exact", head: true })
          .eq("complete", false),
        supabase.from("projects").select("id", { count: "exact", head: true }),
        supabase.from("waiting_items").select("id", { count: "exact", head: true }),
        supabase.from("someday_items").select("id", { count: "exact", head: true }),
        supabase
          .from("tasks")
          .select("*")
          .eq("complete", false)
          .order("created_at", { ascending: false }),
      ]);

    setCounts({
      inbox: inbox.count ?? 0,
      next: next.count ?? 0,
      projects: projects.count ?? 0,
      waiting: waiting.count ?? 0,
      someday: someday.count ?? 0,
    });

    setTasks(taskResult.data ?? []);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

  const topTasks = useMemo(() => {
    return [...tasks]
      .sort((a, b) => {
        const priorityDiff =
          (priorityWeight[b.priority || "Medium"] || 0) -
          (priorityWeight[a.priority || "Medium"] || 0);

        if (priorityDiff !== 0) return priorityDiff;

        const aDue = a.due ? new Date(a.due).getTime() : Number.POSITIVE_INFINITY;
        const bDue = b.due ? new Date(b.due).getTime() : Number.POSITIVE_INFINITY;

        return aDue - bDue;
      })
      .slice(0, 5);
  }, [tasks]);

  const toggleTask = async (task: any) => {
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

    await syncProjectStats(task.project, user?.id);
    load();
  };

  const saveTask = async () => {
    if (!editingTask) return;

    const previousProject = tasks.find((task) => task.id === editingTask.id)?.project || "";
    setSaving(true);

    const { error } = await supabase
      .from("tasks")
      .update({
        title: editingTask.title || "",
        notes: editingTask.notes || "",
        project: editingTask.project || "",
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

    await syncProjectStatsForNames([previousProject, editingTask.project], user?.id);
    toast.success("Task updated");
    setEditingTask(null);
    load();
  };

  const taskAreas = [
    {
      title: "Inbox",
      description: "Quick capture and clarify what has your attention.",
      icon: Inbox,
      to: "/tasks/inbox",
      count: counts.inbox,
    },
    {
      title: "Next Actions",
      description: "See what can be done now by context, priority, and date.",
      icon: ListChecks,
      to: "/tasks/next",
      count: counts.next,
    },
    {
      title: "Projects",
      description: "Track outcomes, notes, progress, and linked next actions.",
      icon: FolderKanban,
      to: "/tasks/projects",
      count: counts.projects,
    },
    {
      title: "Waiting For",
      description: "Track delegated items and follow-up responsibilities.",
      icon: Clock,
      to: "/tasks/waiting",
      count: counts.waiting,
    },
    {
      title: "Someday / Maybe",
      description: "Hold future ideas without cluttering active work.",
      icon: Sparkles,
      to: "/tasks/someday",
      count: counts.someday,
    },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="ACTSIX: Tasks"
        title="Tasks Dashboard"
        subtitle="Capture, clarify, organize, and act within the ACTSIX Tasks module."
      />

      <div className="w-full space-y-8 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="p-6 border-border/70 bg-card shadow-card">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-brand-teal font-bold text-sm">
                <LayoutDashboard className="h-4 w-4" />
                ACTSIX: Tasks
              </div>

              <h2 className="mt-3 text-2xl font-extrabold tracking-tight">
                Your ministry work dashboard
              </h2>

              <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
                This is the dedicated command center for everything related to
                tasks, projects, next actions, waiting items, and weekly review.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="actsix-btn-primary rounded-xl"
                onClick={() => setQuickCaptureOpen(true)}
              >
                Quick Capture
              </Button>

              <Button asChild variant="outline" className="rounded-xl">
                <Link to="/tasks/next">Open Next Actions</Link>
              </Button>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card className="p-5 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">Inbox</p>
            <div className="mt-2 text-3xl font-extrabold">{counts.inbox}</div>
          </Card>

          <Card className="p-5 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">Next Actions</p>
            <div className="mt-2 text-3xl font-extrabold">{counts.next}</div>
          </Card>

          <Card className="p-5 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">Projects</p>
            <div className="mt-2 text-3xl font-extrabold">{counts.projects}</div>
          </Card>

          <Card className="p-5 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">Waiting</p>
            <div className="mt-2 text-3xl font-extrabold">{counts.waiting}</div>
          </Card>

          <Card className="p-5 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">Someday</p>
            <div className="mt-2 text-3xl font-extrabold">{counts.someday}</div>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="p-6 border-border/70 bg-card shadow-card">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight">
                  Highest Priority
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  The most important active next actions.
                </p>
              </div>
              <span className="chip bg-secondary text-secondary-foreground">
                Top {topTasks.length}
              </span>
            </div>

            <div className="rounded-2xl border border-border/70 bg-muted/10 p-2 space-y-1.5">
              {topTasks.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground text-center">
                  No active next actions yet.
                </div>
              )}

              {topTasks.map((task) => (
                <CompactTaskRow
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onEdit={(task) => setEditingTask({ ...task })}
                />
              ))}
            </div>
          </Card>

          <div className="grid gap-4">
            {taskAreas.map((area) => {
              const Icon = area.icon;

              return (
                <Link key={area.title} to={area.to}>
                  <Card className="p-4 border-border/70 bg-card shadow-card hover:border-brand-teal/40 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-brand-teal/10 text-brand-teal flex items-center justify-center">
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="font-extrabold tracking-tight">
                            {area.title}
                          </h3>
                          <span className="text-xs font-mono font-bold text-brand-teal">
                            {area.count}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {area.description}
                        </p>
                      </div>

                      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-brand-teal transition-colors" />
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <TaskEditorModal
        task={editingTask}
        saving={saving}
        eyebrow="Edit Next Action"
        description="Select a project and context from your ACTSIX lists."
        onChange={setEditingTask}
        onClose={() => setEditingTask(null)}
        onSave={saveTask}
        onRefreshOptions={load}
      />
      <QuickCaptureDialog
        open={quickCaptureOpen}
        onOpenChange={setQuickCaptureOpen}
      />
    </div>
  );
};

export default TasksDashboard;
