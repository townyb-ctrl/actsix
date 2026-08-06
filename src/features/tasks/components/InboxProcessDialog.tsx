import { type ComponentType, useId, useState } from "react";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Archive,
  ChevronDown,
  CheckCircle2,
  Clock,
  FolderKanban,
  Save,
} from "lucide-react";
import ProjectSelect from "@/components/ProjectSelect";
import NextActionFields from "@/components/NextActionFields";
import type { InboxItem } from "../pages/InboxPage";

export type ProcessTarget = "" | "task" | "project" | "waiting" | "someday";

export const targetLabels: Record<Exclude<ProcessTarget, "">, string> = {
  task: "Next Action",
  project: "Project",
  waiting: "Waiting For",
  someday: "Someday / Maybe",
};

const destinationOptions: Array<{
  value: Exclude<ProcessTarget, "">;
  label: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  {
    value: "task",
    label: "Task",
    description: "Something you need to do",
    icon: CheckCircle2,
  },
  {
    value: "project",
    label: "Project",
    description: "Something with multiple steps",
    icon: FolderKanban,
  },
  {
    value: "waiting",
    label: "Person / People",
    description: "Contact or pastoral follow-up",
    icon: Clock,
  },
  {
    value: "someday",
    label: "Someday",
    description: "Not now, maybe later",
    icon: Archive,
  },
];

const primaryActionLabels: Record<Exclude<ProcessTarget, "">, string> = {
  task: "Save as task",
  project: "Create project",
  waiting: "Save person follow-up",
  someday: "Move to someday",
};

const footerReadyLabels: Record<Exclude<ProcessTarget, "">, string> = {
  task: "Ready to save as task.",
  project: "Ready to create project.",
  waiting: "Ready to save person follow-up.",
  someday: "Ready to move to someday.",
};

const looksLikeSimpleAction = (title?: string | null) => {
  const clean = String(title || "").trim();
  if (!clean || clean.includes("?") || clean.length > 80) return false;

  return /^(call|cook|prepare|send|write|email|text|buy|pick up|fetch|confirm|follow up|review|schedule|book|create|finish|fix|update|plan|ask)\b/i.test(clean);
};

type InboxProcessDialogProps = {
  item: InboxItem;
  saving: boolean;
  processing: boolean;
  onChangeItem: (item: InboxItem) => void;
  onClose: () => void;
  onSaveDraft: () => void;
  onProcess: (target: Exclude<ProcessTarget, "">) => void;
  onRefreshOptions: () => void | Promise<void>;
};

/** Owns "which destination + destination-specific fields" state for one inbox
 * item. Parent remounts this (via `key={item.id}`) per item, so that local
 * state doesn't need manual resetting between items. */
const InboxProcessDialog = ({
  item,
  saving,
  processing,
  onChangeItem,
  onClose,
  onSaveDraft,
  onProcess,
  onRefreshOptions,
}: InboxProcessDialogProps) => {
  const [processTarget, setProcessTarget] = useState<ProcessTarget>("");
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [choosingDestination, setChoosingDestination] = useState(true);

  const fieldId = useId();
  const processTitleFieldId = `${fieldId}-process-title`;
  const waitingPersonFieldId = `${fieldId}-waiting-person`;
  const waitingFollowUpFieldId = `${fieldId}-waiting-follow-up`;
  const waitingProjectFieldId = `${fieldId}-waiting-project`;
  const somedayCategoryFieldId = `${fieldId}-someday-category`;
  const notesFieldId = `${fieldId}-notes`;
  const tagsFieldId = `${fieldId}-tags`;

  const canProcess = Boolean(processTarget) && !saving && !processing;
  const selectedDestination = processTarget
    ? destinationOptions.find((option) => option.value === processTarget)
    : null;
  const suggestedTask = looksLikeSimpleAction(item.title);

  return (
    <DialogContent className="flex h-[92svh] max-w-4xl flex-col gap-0 overflow-hidden rounded-b-none p-0 sm:h-[88vh] sm:rounded-xl">
      <DialogHeader className="border-b border-border/70 px-4 py-3 pr-12 text-left sm:px-5 sm:py-3 sm:pr-14">
        <div>
          <p className="label-eyebrow text-[0.65rem]">Process Inbox Item</p>
          <DialogTitle className="mt-0.5 text-lg font-extrabold tracking-tight">
            Process inbox item
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-sm">
            Decide what this should become.
          </DialogDescription>
        </div>
      </DialogHeader>

      <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
        <section className="rounded-xl border border-border/70 bg-card px-3 py-2 shadow-sm">
          <label htmlFor={processTitleFieldId} className="label-eyebrow text-[0.65rem]">
            {selectedDestination
              ? processTarget === "project"
                ? "Project name"
                : "Title"
              : "Inbox item"}
          </label>

          {selectedDestination ? (
            <Input
              id={processTitleFieldId}
              value={item.title ?? ""}
              onChange={(event) => onChangeItem({ ...item, title: event.target.value })}
              className="mt-1 h-8 rounded-xl border-border/70 bg-background text-base sm:text-xs"
              placeholder={
                processTarget === "project"
                  ? "Name the project"
                  : "What has your attention?"
              }
            />
          ) : (
            <p className="mt-0.5 text-base font-bold leading-snug text-foreground">
              “{item.title || "Untitled inbox item"}”
            </p>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold tracking-tight">What should this become?</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {selectedDestination && !choosingDestination
                  ? "You can change the type if this is not quite right."
                  : "Choose what this item should become."}
              </p>
            </div>

            {!processTarget && suggestedTask && (
              <span className="rounded-full border border-brand-teal/20 bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                Task looks likely
              </span>
            )}
          </div>

          {selectedDestination && !choosingDestination ? (
            <div className="rounded-xl border border-brand-teal/25 bg-brand-teal/5 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal text-white">
                    <selectedDestination.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold">{selectedDestination.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {selectedDestination.description}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 rounded-xl px-3"
                  onClick={() => setChoosingDestination(true)}
                >
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {destinationOptions.map((option) => {
                const Icon = option.icon;
                const selected = processTarget === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setProcessTarget(option.value);
                      setMoreOptionsOpen(false);
                      setChoosingDestination(false);
                    }}
                    className={[
                      "group rounded-xl border p-4 text-left transition",
                      "hover:-translate-y-0.5 hover:border-brand-teal/40 hover:bg-brand-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/35",
                      selected
                        ? "border-brand-teal bg-brand-teal/10 shadow-sm"
                        : "border-border/70 bg-card",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                          selected
                            ? "border-brand-teal/30 bg-brand-teal text-white"
                            : "border-border/70 bg-background text-brand-teal",
                        ].join(" ")}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <span className="min-w-0">
                        <span className="block text-sm font-extrabold">{option.label}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {option.description}
                        </span>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {selectedDestination && (
          <>
            {processTarget === "task" && (
              <NextActionFields
                item={item}
                onChange={onChangeItem}
                onRefreshOptions={onRefreshOptions}
                showOrganization={false}
                variant="inbox"
              />
            )}

            {processTarget === "waiting" && (
              <section>
                <div className="mb-1.5 flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-brand-teal" />
                  <h3 className="text-sm font-extrabold tracking-tight">Person follow-up details</h3>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label htmlFor={waitingPersonFieldId} className="label-eyebrow text-[0.65rem]">Person or team</label>
                    <Input
                      id={waitingPersonFieldId}
                      value={item.waiting_person ?? ""}
                      onChange={(event) =>
                        onChangeItem({ ...item, waiting_person: event.target.value })
                      }
                      className="h-8 border-border/70 bg-background text-base sm:text-xs"
                      placeholder="Person or team"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={waitingFollowUpFieldId} className="label-eyebrow text-[0.65rem]">Follow-up date</label>
                    <Input
                      id={waitingFollowUpFieldId}
                      type="date"
                      value={item.waiting_follow_up ?? ""}
                      onChange={(event) =>
                        onChangeItem({ ...item, waiting_follow_up: event.target.value || null })
                      }
                      className="h-8 border-border/70 bg-background text-base sm:text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label htmlFor={waitingProjectFieldId} className="label-eyebrow text-[0.65rem]">Project</label>
                    <ProjectSelect
                      id={waitingProjectFieldId}
                      value={item.project ?? ""}
                      onChange={(project) => onChangeItem({ ...item, project })}
                      onProjectChange={(project) =>
                        onChangeItem({
                          ...item,
                          project: project?.name ?? item.project ?? "",
                          project_id: project?.id ?? null,
                        })
                      }
                      onCreated={onRefreshOptions}
                      selectClassName="h-8 w-full rounded-lg border border-border/70 bg-background px-2.5 text-base shadow-none outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
                    />
                  </div>
                </div>
              </section>
            )}

            {processTarget === "someday" && (
              <section>
                <div className="mb-1.5 flex items-center gap-2">
                  <Archive className="h-3.5 w-3.5 text-brand-teal" />
                  <h3 className="text-sm font-extrabold tracking-tight">Someday details</h3>
                </div>

                <div className="space-y-1">
                  <label htmlFor={somedayCategoryFieldId} className="label-eyebrow text-[0.65rem]">Category</label>
                  <Input
                    id={somedayCategoryFieldId}
                    value={item.someday_category ?? "General"}
                    onChange={(event) =>
                      onChangeItem({ ...item, someday_category: event.target.value })
                    }
                    className="h-8 border-border/70 bg-background text-sm"
                    placeholder="Idea, Future, Ministry..."
                  />
                </div>
              </section>
            )}

            {processTarget === "project" && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <FolderKanban className="h-4 w-4 text-brand-teal" />
                  <h3 className="font-extrabold tracking-tight">Project details</h3>
                </div>

                <div className="actsix-empty-state p-4 text-left">
                  <p className="text-sm text-muted-foreground">
                    This will create a project using the title above as the project name.
                  </p>
                </div>
              </section>
            )}

            <section className="rounded-xl border border-border/70 bg-card">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                onClick={() => setMoreOptionsOpen((open) => !open)}
                aria-expanded={moreOptionsOpen}
              >
                <span>
                  <span className="block text-sm font-extrabold">More options</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Add notes or extra context.
                  </span>
                </span>
                <ChevronDown
                  className={[
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                    moreOptionsOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </button>

              {moreOptionsOpen && (
                <div className="grid gap-2.5 border-t border-border/70 p-3 sm:grid-cols-2">
                  <div className="space-y-1 sm:col-span-2">
                    <label htmlFor={notesFieldId} className="label-eyebrow text-[0.65rem]">Notes</label>
                    <textarea
                      id={notesFieldId}
                      value={item.notes ?? ""}
                      onChange={(event) => onChangeItem({ ...item, notes: event.target.value })}
                      className="min-h-14 w-full rounded-md border border-border/70 bg-background px-2.5 py-2 text-base outline-none focus:ring-2 focus:ring-ring sm:text-xs"
                      placeholder="Add details, links, thoughts, or next-step context..."
                    />
                  </div>

                  {processTarget === "task" && (
                    <div className="space-y-1 sm:col-span-2">
                      <label htmlFor={tagsFieldId} className="label-eyebrow text-[0.65rem]">Tags</label>
                      <Input
                        id={tagsFieldId}
                        value={Array.isArray(item.tags) ? item.tags.join(", ") : ""}
                        onChange={(event) =>
                          onChangeItem({
                            ...item,
                            tags: event.target.value
                              .split(",")
                              .map((tag) => tag.trim())
                              .filter(Boolean),
                          })
                        }
                        className="h-8 rounded-lg border-border/70 bg-background text-base shadow-none focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15 sm:text-xs"
                        placeholder="Worship, Admin, Follow-up"
                      />
                      <p className="text-xs text-muted-foreground">
                        Separate tags with commas.
                      </p>
                    </div>
                  )}

                  {processTarget !== "task" && (
                    <p className="text-sm text-muted-foreground sm:col-span-2">
                      No additional fields are required for this type.
                    </p>
                  )}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 bg-background/95 p-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          {processTarget
            ? footerReadyLabels[processTarget]
            : "Choose what this should become before saving."}
        </p>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Cancel
          </Button>

          {processTarget && (
            <Button
              disabled={saving}
              variant="outline"
              className="rounded-xl"
              onClick={onSaveDraft}
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save draft"}
            </Button>
          )}

          <Button
            disabled={!canProcess}
            className="col-span-2 rounded-xl actsix-btn-primary min-h-10 font-bold sm:col-span-1"
            onClick={() => processTarget && onProcess(processTarget)}
          >
            {processTarget ? primaryActionLabels[processTarget] : "Choose type to continue"}
          </Button>
        </div>
      </div>
    </DialogContent>
  );
};

export default InboxProcessDialog;
