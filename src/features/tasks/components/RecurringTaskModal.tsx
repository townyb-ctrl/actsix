import { CalendarClock, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import NextActionFields from "@/components/NextActionFields";
import type { RecurringTemplateDraft } from "@/features/tasks/types/recurringTasks";

type Props = {
  template: RecurringTemplateDraft | null;
  saving?: boolean;
  mode?: "create" | "edit" | "view";
  onChange: (template: RecurringTemplateDraft) => void;
  onClose: () => void;
  onSave: () => void;
};

const selectClassName =
  "mt-2 h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15";

const fieldClassName = "rounded-xl border border-border/70 bg-background/70 p-4";

const RecurringTaskModal = ({
  template,
  saving = false,
  mode = "create",
  onChange,
  onClose,
  onSave,
}: Props) => {
  if (!template) return null;

  const readOnly = mode === "view";
  const title = mode === "edit" ? "Edit recurring task" : mode === "view" ? "Recurring task" : "New recurring task";

  const update = (patch: Partial<RecurringTemplateDraft>) => onChange({ ...template, ...patch });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-brand-ink/35 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="recurring-task-modal-title"
    >
      <Card className="actsix-panel flex max-h-[92svh] w-full max-w-4xl flex-col overflow-hidden rounded-b-none sm:h-[88vh] sm:rounded-[var(--radius-overlay)]">
        <div className="flex items-start justify-between gap-4 border-b border-border/70 p-4 sm:p-5">
          <div>
            <p className="label-eyebrow">Recurring Rhythm</p>
            <h2 id="recurring-task-modal-title" className="mt-1 text-xl font-extrabold leading-tight">
              {title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a calm repeatable ministry responsibility.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
          <section className="grid gap-3">
            <div className={fieldClassName}>
              <label className="label-eyebrow">Title</label>
              <Input
                disabled={readOnly}
                value={template.title}
                onChange={(event) => update({ title: event.target.value })}
                className="mt-2 h-10 rounded-xl border-border/70 bg-background shadow-none"
                placeholder="Prepare Sunday volunteer follow-up"
              />
            </div>

            <div className={fieldClassName}>
              <label className="label-eyebrow">Description</label>
              <textarea
                disabled={readOnly}
                value={template.description}
                onChange={(event) => update({ description: event.target.value })}
                className="mt-2 min-h-24 w-full rounded-xl border border-border/70 bg-background px-3 py-2 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                placeholder="Add the recurring ministry context, checklist, or links..."
              />
            </div>
          </section>

          <div className={readOnly ? "pointer-events-none opacity-80" : ""}>
            <NextActionFields item={template} onChange={onChange} showOrganization />
          </div>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand-teal" />
              <h3 className="font-extrabold tracking-tight">Recurrence</h3>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className={fieldClassName}>
                <label className="label-eyebrow">First due date</label>
                <Input
                  disabled={readOnly}
                  type="date"
                  value={template.first_due_date}
                  onChange={(event) =>
                    update({
                      first_due_date: event.target.value,
                      next_due_date: event.target.value,
                    })
                  }
                  className="mt-2 h-10 rounded-xl border-border/70 bg-background shadow-none"
                />
              </div>

              <div className={fieldClassName}>
                <label className="label-eyebrow">Repeat frequency</label>
                <select
                  disabled={readOnly}
                  value={template.frequency}
                  onChange={(event) => update({ frequency: event.target.value as RecurringTemplateDraft["frequency"] })}
                  className={selectClassName}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div className={fieldClassName}>
                <label className="label-eyebrow">Interval</label>
                <Input
                  disabled={readOnly}
                  type="number"
                  min={1}
                  value={template.interval}
                  onChange={(event) => update({ interval: Math.max(1, Number(event.target.value) || 1) })}
                  className="mt-2 h-10 rounded-xl border-border/70 bg-background shadow-none"
                />
              </div>

              <div className={fieldClassName}>
                <label className="label-eyebrow">End condition</label>
                <select
                  disabled={readOnly}
                  value={template.end_condition}
                  onChange={(event) => update({ end_condition: event.target.value as RecurringTemplateDraft["end_condition"] })}
                  className={selectClassName}
                >
                  <option value="never">Never</option>
                  <option value="on_date">On date</option>
                  <option value="after_occurrences">After occurrences</option>
                </select>
              </div>

              {template.end_condition === "on_date" && (
                <div className={fieldClassName}>
                  <label className="label-eyebrow">End date</label>
                  <Input
                    disabled={readOnly}
                    type="date"
                    value={template.end_date || ""}
                    onChange={(event) => update({ end_date: event.target.value || null })}
                    className="mt-2 h-10 rounded-xl border-border/70 bg-background shadow-none"
                  />
                </div>
              )}

              {template.end_condition === "after_occurrences" && (
                <div className={fieldClassName}>
                  <label className="label-eyebrow">Occurrences</label>
                  <Input
                    disabled={readOnly}
                    type="number"
                    min={1}
                    value={template.end_after_occurrences || 1}
                    onChange={(event) => update({ end_after_occurrences: Math.max(1, Number(event.target.value) || 1) })}
                    className="mt-2 h-10 rounded-xl border-border/70 bg-background shadow-none"
                  />
                </div>
              )}

              <div className={fieldClassName}>
                <label className="label-eyebrow">Creation mode</label>
                <select
                  disabled={readOnly}
                  value={template.creation_mode}
                  onChange={(event) => update({ creation_mode: event.target.value as RecurringTemplateDraft["creation_mode"] })}
                  className={selectClassName}
                >
                  <option value="on_completion">Create next task on completion</option>
                  <option value="ahead_of_time">Create ahead of time</option>
                </select>
              </div>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-background/90 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            The generated items will appear as normal Next Actions.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="actsix-btn-outline" onClick={onClose}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && (
              <Button disabled={saving} className="actsix-btn-primary" onClick={onSave}>
                <Save className="h-4 w-4" />
                {saving ? "Saving..." : "Save rhythm"}
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
};

export default RecurringTaskModal;
