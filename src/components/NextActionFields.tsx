import { CheckCircle2, Clock, Tags } from "lucide-react";
import { Input } from "@/components/ui/input";
import ProjectSelect from "@/components/ProjectSelect";
import ContextSelect from "@/components/ContextSelect";

type NextActionFieldsProps = {
  item: any;
  onChange: (item: any) => void;
  onRefreshOptions?: () => void | Promise<void>;
};

const NextActionFields = ({
  item,
  onChange,
  onRefreshOptions,
}: NextActionFieldsProps) => {
  if (!item) return null;

  return (
    <>
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CheckCircle2 className="h-4 w-4 text-brand-teal" />
          <h3 className="font-extrabold tracking-tight">Next Action details</h3>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <label className="label-eyebrow">Project</label>
            <ProjectSelect
              value={item.project ?? ""}
              onChange={(project) => onChange({ ...item, project })}
              onCreated={onRefreshOptions}
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <label className="label-eyebrow">Context</label>
            <ContextSelect
              value={item.context ?? "General"}
              onChange={(context) => onChange({ ...item, context })}
              onCreated={onRefreshOptions}
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <label className="label-eyebrow flex items-center gap-2">
              <Clock className="h-3.5 w-3.5" />
              Duration
            </label>
            <Input
              type="number"
              min="1"
              value={item.minutes ?? 15}
              onChange={(event) =>
                onChange({
                  ...item,
                  minutes: Number(event.target.value) || 15,
                })
              }
              className="mt-2 border-border/70 bg-background"
            />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <label className="label-eyebrow">Priority</label>
            <select
              value={item.priority ?? "Medium"}
              onChange={(event) =>
                onChange({ ...item, priority: event.target.value })
              }
              className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
              <option>Urgent</option>
            </select>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <label className="label-eyebrow">Energy</label>
            <select
              value={item.energy ?? "Medium"}
              onChange={(event) =>
                onChange({ ...item, energy: event.target.value })
              }
              className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
            >
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>

          <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
            <label className="label-eyebrow">Due date</label>
            <Input
              type="date"
              value={item.due ?? ""}
              onChange={(event) =>
                onChange({ ...item, due: event.target.value || null })
              }
              className="mt-2 border-border/70 bg-background"
            />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center gap-2 mb-3">
          <Tags className="h-4 w-4 text-brand-teal" />
          <h3 className="font-extrabold tracking-tight">Organization</h3>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
          <label className="label-eyebrow">Tags</label>
          <Input
            value={Array.isArray(item.tags) ? item.tags.join(", ") : ""}
            onChange={(event) =>
              onChange({
                ...item,
                tags: event.target.value
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              })
            }
            className="mt-2 border-border/70 bg-background"
            placeholder="Worship, Admin, Follow-up"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Separate tags with commas.
          </p>
        </div>
      </section>
    </>
  );
};

export default NextActionFields;
