import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  Eye,
  Pause,
  Play,
  Plus,
  SkipForward,
  SquarePen,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import RecurringTaskModal from "@/features/tasks/components/RecurringTaskModal";
import {
  calculateNextDueDate,
  formatFrequencyLabel,
  getTemplateNextDueDate,
} from "@/features/tasks/lib/recurringTaskDates";
import {
  createTaskInstanceFromTemplate,
} from "@/features/tasks/api/recurringTasksApi";
import type { RecurringTaskTemplate, RecurringTemplateDraft } from "@/features/tasks/types/recurringTasks";

const todayKey = () => new Date().toISOString().slice(0, 10);

const emptyDraft = (): RecurringTemplateDraft => ({
  title: "",
  description: "",
  project: "",
  project_id: null,
  assigned_person_id: null,
  priority: "Medium",
  context: "General",
  energy: "Medium",
  minutes: 15,
  tags: [],
  first_due_date: todayKey(),
  next_due_date: todayKey(),
  frequency: "weekly",
  interval: 1,
  end_condition: "never",
  end_date: null,
  end_after_occurrences: null,
  creation_mode: "on_completion",
  status: "active",
});

const statusClasses: Record<string, string> = {
  active: "border-brand-teal/20 bg-brand-teal/10 text-brand-teal",
  paused: "border-amber-200 bg-amber-50 text-amber-700",
  ended: "border-border bg-muted text-muted-foreground",
};

const RecurringTasksPage = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<RecurringTaskTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RecurringTemplateDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalMode, setModalMode] = useState<"create" | "edit" | "view">("create");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("recurring_task_templates")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setTemplates((data || []) as RecurringTaskTemplate[]);
    setLoading(false);
  };

  useEffect(() => {
    if (user) load();
  }, [user?.id]);

  const counts = useMemo(
    () => ({
      active: templates.filter((template) => template.status === "active").length,
      paused: templates.filter((template) => template.status === "paused").length,
      ended: templates.filter((template) => template.status === "ended").length,
    }),
    [templates]
  );

  const openNew = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setModalMode("create");
  };

  const openTemplate = (template: RecurringTaskTemplate, mode: "view" | "edit") => {
    setDraft({
      title: template.title,
      description: template.description,
      project: template.project,
      project_id: template.project_id,
      assigned_person_id: template.assigned_person_id,
      priority: template.priority,
      context: template.context,
      energy: template.energy,
      minutes: template.minutes,
      tags: template.tags || [],
      first_due_date: template.first_due_date,
      next_due_date: template.next_due_date,
      frequency: template.frequency,
      interval: template.interval,
      end_condition: template.end_condition,
      end_date: template.end_date,
      end_after_occurrences: template.end_after_occurrences,
      creation_mode: template.creation_mode,
      status: template.status,
    });
    setEditingId(template.id);
    setModalMode(mode);
  };

  const save = async () => {
    if (!user || !draft) return;
    if (!draft.title.trim()) {
      toast.error("Add a title for this recurring task.");
      return;
    }

    setSaving(true);
    const payload = {
      ...draft,
      title: draft.title.trim(),
      description: draft.description || "",
      interval: Math.max(1, Number(draft.interval) || 1),
      end_date: draft.end_condition === "on_date" ? draft.end_date : null,
      end_after_occurrences:
        draft.end_condition === "after_occurrences" ? draft.end_after_occurrences : null,
      next_due_date: draft.next_due_date || draft.first_due_date,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await (supabase as any).from("recurring_task_templates").update(payload).eq("id", editingId)
      : await (supabase as any)
          .from("recurring_task_templates")
          .insert({ ...payload, user_id: user.id })
          .select("*")
          .single();

    if (result.error) {
      toast.error(result.error.message);
      setSaving(false);
      return;
    }

    if (!editingId) {
      try {
        await createTaskInstanceFromTemplate(result.data as RecurringTaskTemplate, payload.first_due_date);
      } catch (error: any) {
        toast.error(error.message || "Template saved, but the first Next Action was not created.");
      }
    }

    toast.success(editingId ? "Recurring task updated" : "Recurring task created");
    setSaving(false);
    setDraft(null);
    setEditingId(null);
    load();
  };

  const updateStatus = async (template: RecurringTaskTemplate, status: RecurringTaskTemplate["status"]) => {
    const { error } = await (supabase as any)
      .from("recurring_task_templates")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", template.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(status === "ended" ? "Recurrence ended" : `Recurring task ${status}`);
    load();
  };

  const deleteTemplate = async (template: RecurringTaskTemplate) => {
    const confirmed = window.confirm(`Delete "${template.title}"? Existing generated tasks will stay in Next Actions.`);
    if (!confirmed) return;

    const { error } = await (supabase as any)
      .from("recurring_task_templates")
      .delete()
      .eq("id", template.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Recurring template deleted");
    load();
  };

  const skipNext = async (template: RecurringTaskTemplate) => {
    const currentNextDue = getTemplateNextDueDate(template);
    const skippedTo = calculateNextDueDate(currentNextDue, template.frequency, template.interval);
    const { error } = await (supabase as any)
      .from("recurring_task_templates")
      .update({ next_due_date: skippedTo, updated_at: new Date().toISOString() })
      .eq("id", template.id);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Next occurrence skipped");
    load();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Workflow"
        title="Recurring Tasks"
        subtitle="Simple ministry rhythms without cluttering your Next Actions list."
        actions={
          <Button className="actsix-btn-primary rounded-lg" onClick={openNew}>
            <Plus className="h-4 w-4" />
            New Recurring Task
          </Button>
        }
      />

      <div className="w-full space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <div className="grid gap-3 md:grid-cols-3">
          {[
            ["Active", counts.active, CheckCircle2],
            ["Paused", counts.paused, Pause],
            ["Ended", counts.ended, XCircle],
          ].map(([label, count, Icon]) => (
            <Card key={String(label)} className="actsix-panel-soft p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="label-eyebrow">{String(label)}</p>
                  <p className="mt-1 text-2xl font-extrabold">{Number(count)}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="actsix-panel p-2">
          {loading && <div className="actsix-loading-state">Loading recurring tasks...</div>}

          {!loading && templates.length === 0 && (
            <div className="actsix-empty-state">
              No recurring task templates yet. Add one for a daily, weekly, monthly, quarterly, or yearly rhythm.
            </div>
          )}

          <div className="grid gap-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="rounded-xl border border-border/70 bg-background/75 p-4 transition hover:border-brand-teal/25 hover:bg-brand-teal/5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusClasses[template.status]}>
                        {template.status[0].toUpperCase() + template.status.slice(1)}
                      </Badge>
                      <Badge variant="outline" className="border-border/70 bg-background text-muted-foreground">
                        <CalendarClock className="mr-1 h-3 w-3" />
                        Next due {template.next_due_date || "not scheduled"}
                      </Badge>
                    </div>

                    <h2 className="mt-3 text-base font-extrabold tracking-tight">{template.title}</h2>
                    {template.description && (
                      <p className="mt-1 line-clamp-2 text-sm font-semibold leading-6 text-muted-foreground">
                        {template.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold text-muted-foreground">
                      <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
                        {formatFrequencyLabel(template.frequency, template.interval)}
                      </span>
                      <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
                        {template.priority}
                      </span>
                      {template.project && (
                        <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
                          {template.project}
                        </span>
                      )}
                      <span className="rounded-full border border-border/70 bg-background px-2.5 py-1">
                        {template.generated_count} generated
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
                    <Button variant="outline" size="sm" className="actsix-btn-outline" onClick={() => openTemplate(template, "view")}>
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" className="actsix-btn-outline" onClick={() => openTemplate(template, "edit")}>
                      <SquarePen className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                    {template.status === "paused" ? (
                      <Button variant="outline" size="sm" className="actsix-btn-outline" onClick={() => updateStatus(template, "active")}>
                        <Play className="h-3.5 w-3.5" />
                        Resume
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" className="actsix-btn-outline" onClick={() => updateStatus(template, "paused")} disabled={template.status === "ended"}>
                        <Pause className="h-3.5 w-3.5" />
                        Pause
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="actsix-btn-outline" onClick={() => skipNext(template)} disabled={template.status === "ended"}>
                      <SkipForward className="h-3.5 w-3.5" />
                      Skip next
                    </Button>
                    <Button variant="outline" size="sm" className="actsix-btn-outline text-destructive hover:text-destructive" onClick={() => deleteTemplate(template)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <RecurringTaskModal
        template={draft}
        saving={saving}
        mode={modalMode}
        onChange={setDraft}
        onClose={() => {
          setDraft(null);
          setEditingId(null);
        }}
        onSave={save}
      />
    </div>
  );
};

export default RecurringTasksPage;
