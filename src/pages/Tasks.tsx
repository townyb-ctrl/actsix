import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronDown,
  ChevronRight,
  Edit3,
  Inbox as InboxIcon,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import TaskEditorModal from "@/components/TaskEditorModal";
import { syncProjectStats, syncProjectStatsForNames } from "@/lib/syncProjectStats";

const PriorityChip = ({ p }: { p?: string | null }) => {
  const priority = p || "Medium";

  const map: Record<string, string> = {
    Low: "bg-secondary text-secondary-foreground",
    Medium: "bg-brand-amber/15 text-brand-amber",
    High: "bg-brand-coral/15 text-brand-coral",
    Urgent: "bg-brand-coral text-white",
  };

  return <span className={`chip ${map[priority] ?? map.Medium}`}>{priority}</span>;
};

const Tasks = () => {
  const { user } = useAuth();

  const [tasks, setTasks] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);

  const load = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    setTasks(data ?? []);
  };

  useEffect(() => {
    if (user) load();
  }, [user]);

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

    await syncProjectStats(task.project, user?.id);
    load();
  };

  const remove = async (id: string) => {
    const targetTask = tasks.find((task) => task.id === id);

    const { error } = await supabase.from("tasks").delete().eq("id", id);

    if (error) {
      toast.error(error.message);
      return;
    }

    await syncProjectStats(targetTask?.project, user?.id);
    toast.success("Task deleted");
    load();
  };

  const saveTask = async () => {
    if (!editingTask) return;

    const previousProject =
      tasks.find((task) => task.id === editingTask.id)?.project || "";

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

  const open = tasks.filter((task) => !task.complete);
  const done = tasks.filter((task) => task.complete);

  return (
    <div>
      <PageHeader
        eyebrow="Workflow"
        title="Next Actions"
        subtitle="The next thing to do, in any context."
      />

      <div className="px-8 -mt-2 pb-4 max-w-5xl flex justify-end">
        <Button
          asChild
          className="rounded-xl bg-brand-teal hover:bg-brand-teal/90 text-white"
        >
          <Link to="/inbox">
            <InboxIcon className="h-4 w-4 mr-2" />
            Quick Capture
          </Link>
        </Button>
      </div>

      <div className="px-8 pb-12 max-w-5xl space-y-6">
        <section>
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-xl font-extrabold tracking-tight">
              Open{" "}
              <span className="text-muted-foreground font-normal text-base">
                · {open.length}
              </span>
            </h2>
          </div>

          <Card className="p-2 space-y-2 shadow-card border-border/70 bg-card">
            {open.length === 0 && (
              <div className="p-6 text-sm text-muted-foreground">All clear.</div>
            )}

            {open.map((task) => (
              <div
                key={task.id}
                className="action-row flex items-start gap-3 p-4 group"
              >
                <Checkbox
                  checked={task.complete}
                  onCheckedChange={() => toggle(task)}
                  className="mt-1"
                />

                <div className="flex-1 min-w-0">
                  <div className="font-semibold">{task.title}</div>

                  {task.notes && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {task.notes}
                    </p>
                  )}

                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="chip bg-brand-teal/10 text-brand-teal border-brand-teal/20">
                      {task.context || "General"}
                    </span>
                    <PriorityChip p={task.priority} />
                    <span className="chip bg-secondary text-secondary-foreground">
                      Energy: {task.energy || "Medium"}
                    </span>
                    <span className="chip bg-secondary text-secondary-foreground font-mono">
                      {task.minutes || 15}m
                    </span>
                    {task.project && (
                      <span className="chip bg-secondary text-secondary-foreground">
                        {task.project}
                      </span>
                    )}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full opacity-0 group-hover:opacity-100"
                  onClick={() => setEditingTask({ ...task })}
                >
                  <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                  Edit
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => remove(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Card>
        </section>

        {done.length > 0 && (
          <section>
            <button
              type="button"
              onClick={() => setShowCompleted((value) => !value)}
              className="w-full flex items-center justify-between mb-3 rounded-2xl border border-border/70 bg-card px-4 py-3 shadow-soft hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                {showCompleted ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}

                <h2 className="text-xl font-extrabold tracking-tight text-muted-foreground">
                  Completed{" "}
                  <span className="font-normal text-base">· {done.length}</span>
                </h2>
              </div>

              <span className="text-xs font-bold text-muted-foreground">
                {showCompleted ? "Collapse" : "Expand"}
              </span>
            </button>

            {showCompleted && (
              <Card className="p-2 space-y-2 shadow-card border-border/70 bg-card opacity-70">
                {done.map((task) => (
                  <div
                    key={task.id}
                    className="action-row flex items-center gap-3 p-4 group"
                  >
                    <Checkbox checked onCheckedChange={() => toggle(task)} />

                    <div className="flex-1 truncate line-through text-muted-foreground">
                      {task.title}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-full opacity-0 group-hover:opacity-100"
                      onClick={() => setEditingTask({ ...task })}
                    >
                      <Edit3 className="h-3.5 w-3.5 mr-1.5" />
                      Edit
                    </Button>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="opacity-0 group-hover:opacity-100"
                      onClick={() => remove(task.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
