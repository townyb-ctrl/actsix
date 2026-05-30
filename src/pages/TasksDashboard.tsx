import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Clock,
  FolderKanban,
  Inbox,
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
        eyebrow="Tasks"
        title="Task Dashboard"
        subtitle="Capture, clarify, and move the next right thing forward."
        actions={
          <>
            <Button
              type="button"
              size="sm"
              className="actsix-btn-primary rounded-lg"
              onClick={() => setQuickCaptureOpen(true)}
            >
              Quick Capture
            </Button>

            <Button asChild variant="outline" size="sm" className="rounded-lg">
              <Link to="/tasks/next">Next Actions</Link>
            </Button>
          </>
        }
      />

      <div className="w-full space-y-6 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <div className="grid gap-px overflow-hidden rounded-lg border border-border/70 bg-border/70 shadow-soft sm:grid-cols-2 lg:grid-cols-5">
          <div className="bg-card px-4 py-3">
            <p className="label-eyebrow">Inbox</p>
            <div className="mt-1 text-2xl font-extrabold">{counts.inbox}</div>
          </div>

          <div className="bg-card px-4 py-3">
            <p className="label-eyebrow">Next Actions</p>
            <div className="mt-1 text-2xl font-extrabold">{counts.next}</div>
          </div>

          <div className="bg-card px-4 py-3">
            <p className="label-eyebrow">Projects</p>
            <div className="mt-1 text-2xl font-extrabold">{counts.projects}</div>
          </div>

          <div className="bg-card px-4 py-3">
            <p className="label-eyebrow">Waiting</p>
            <div className="mt-1 text-2xl font-extrabold">{counts.waiting}</div>
          </div>

          <div className="bg-card px-4 py-3">
            <p className="label-eyebrow">Someday</p>
            <div className="mt-1 text-2xl font-extrabold">{counts.someday}</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <Card className="border-border/70 bg-card p-4 shadow-soft">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-extrabold">
                  Highest Priority
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The most important active next actions.
                </p>
              </div>
              <span className="chip bg-secondary text-secondary-foreground">
                Top {topTasks.length}
              </span>
            </div>

            <div className="space-y-1.5 rounded-md border border-border/70 bg-muted/10 p-2">
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
                  <Card className="border-border/70 bg-card p-3 shadow-soft transition-colors hover:border-brand-teal/40 group">
                    <div className="flex items-center gap-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
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
