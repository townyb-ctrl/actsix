import { AlertTriangle, Plus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { setTurnaroundTaskDone } from "@/features/venues/api/venueTurnaroundApi";
import type {
  VenueBooking,
  VenueSpace,
} from "@/features/venues/lib/venueBookings";
import {
  blockingBookings,
  sortTurnaroundTasks,
  turnaroundProgress,
  type VenueTurnaroundTask,
} from "@/features/venues/lib/venueTurnaround";

type Props = {
  tasks: VenueTurnaroundTask[];
  bookings: VenueBooking[];
  spaces: VenueSpace[];
  /** Who is ticking things off, recorded against the task. */
  doneBy: string;
  onAddTask: () => void;
  onEditTask: (task: VenueTurnaroundTask) => void;
  onChanged: () => void;
};

const formatWindow = (startsAt: string | null, endsAt: string | null) => {
  if (!startsAt || !endsAt) return "Any time before the next service";

  const start = new Date(startsAt);
  const time = (value: Date) =>
    value.toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

  return `${start.toLocaleDateString("en-ZA", {
    weekday: "short",
    day: "numeric",
    month: "short",
  })} · ${time(start)}–${time(new Date(endsAt))}`;
};

export default function VenueTurnaroundPanel({
  tasks,
  bookings,
  spaces,
  doneBy,
  onAddTask,
  onEditTask,
  onChanged,
}: Props) {
  const progress = turnaroundProgress(tasks);
  const ordered = sortTurnaroundTasks(tasks);
  const spaceName = (spaceId: string | null) =>
    spaceId
      ? spaces.find((space) => space.id === spaceId)?.name || "Unknown space"
      : "Whole venue";

  const toggle = async (task: VenueTurnaroundTask) => {
    const { error } = await setTurnaroundTaskDone({
      taskId: task.id,
      done: !task.done,
      doneBy,
    });
    if (error) {
      toast.error("Could not update the task", { description: error.message });
      return;
    }
    onChanged();
  };

  return (
    <section className="st-panel" aria-labelledby="turnaround-heading">
      <div className="st-panel-head">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="st-panel-title" id="turnaround-heading">
            Cleaning &amp; turnaround
          </h2>
          {progress.total > 0 && (
            <Badge variant={progress.allDone ? "default" : "secondary"}>
              {progress.done} of {progress.total} done
            </Badge>
          )}
        </div>

        <Button
          size="sm"
          variant="ghost"
          className="min-h-9"
          onClick={onAddTask}
        >
          <Plus className="h-4 w-4" />
          Add task
        </Button>
      </div>

      {ordered.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Nothing listed. Add what has to happen between this hire ending and
          the next service.
        </p>
      ) : (
        ordered.map((task) => {
          const blocked = blockingBookings(task, bookings);

          return (
            <div key={task.id} className="action-row flex items-start gap-3">
              {/* -m-2 p-2 gives the tick a finger-sized hit area without
                  changing how the row looks. */}
              <span className="-m-2 shrink-0 p-2">
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => toggle(task)}
                  aria-label={`Mark ${task.title} done`}
                  className="mt-1 h-5 w-5"
                />
              </span>

              <button
                type="button"
                onClick={() => onEditTask(task)}
                className="min-h-11 min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
              >
                <span
                  className={cn(
                    "block truncate text-sm font-semibold",
                    task.done && "text-muted-foreground line-through",
                  )}
                >
                  {task.title}
                </span>
                <span className="mt-1 block truncate text-xs text-muted-foreground">
                  {task.kind} · {spaceName(task.space_id)} ·{" "}
                  {formatWindow(task.starts_at, task.ends_at)}
                  {task.done && task.done_by && ` · done by ${task.done_by}`}
                </span>
                {blocked.length > 0 && (
                  <span className="mt-1 flex items-start gap-1.5 text-xs font-medium text-brand-danger">
                    <AlertTriangle
                      className="mt-0.5 h-3.5 w-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {spaceName(task.space_id)} is still booked then
                    {blocked[0].title ? ` for “${blocked[0].title}”` : ""}
                  </span>
                )}
              </button>
            </div>
          );
        })
      )}
    </section>
  );
}
