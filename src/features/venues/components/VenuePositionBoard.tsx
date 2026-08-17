import { Plus, UserMinus, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  assignmentLabel,
  positionsByDay,
  unfilledCount,
  unfilledTotal,
  type PositionPerson,
  type VenuePosition,
  type VenuePositionAssignment,
  type VenuePositionRole,
} from "@/features/venues/lib/venuePositions";

type Props = {
  positions: VenuePosition[];
  assignments: VenuePositionAssignment[];
  roles: VenuePositionRole[];
  people: PositionPerson[];
  onAddPosition: (dayIso?: string) => void;
  onEditPosition: (position: VenuePosition) => void;
  onAssign: (position: VenuePosition) => void;
  onUnassign: (assignment: VenuePositionAssignment) => void;
};

const formatDayHeading = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

export default function VenuePositionBoard({
  positions,
  assignments,
  roles,
  people,
  onAddPosition,
  onEditPosition,
  onAssign,
  onUnassign,
}: Props) {
  const days = positionsByDay(positions);
  const roleName = (roleId: string) =>
    roles.find((role) => role.id === roleId)?.name || "Unknown role";

  const totalUnfilled = unfilledTotal(positions, assignments);

  return (
    <section className="st-panel" aria-labelledby="positions-heading">
      <div className="st-panel-head">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="st-panel-title" id="positions-heading">
            Positions
          </h2>
          {positions.length > 0 && (
            <Badge variant={totalUnfilled > 0 ? "secondary" : "default"}>
              {totalUnfilled > 0 ? `${totalUnfilled} still to fill` : "Fully staffed"}
            </Badge>
          )}
        </div>

        <Button size="sm" variant="ghost" className="min-h-9" onClick={() => onAddPosition()}>
          <Plus className="h-4 w-4" />
          Add position
        </Button>
      </div>

      {days.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No positions yet. Add the roles this event needs: opener, tech, ops, car guards, cleaner,
          closer, and who is on each.
        </p>
      ) : (
        days.map(({ day, positions: dayPositions }) => (
          <div key={day}>
            <div className="flex items-center justify-between gap-2 border-t border-[--st-line-soft] bg-[--st-panel-hi] px-4 py-2">
              <h3 className="label-eyebrow">{formatDayHeading(day)}</h3>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-9 px-2 text-xs"
                onClick={() => onAddPosition(dayPositions[0]?.starts_at)}
              >
                <Plus className="h-3 w-3" />
                Add to this day
              </Button>
            </div>

            {dayPositions.map((position) => {
              const filledBy = assignments.filter((entry) => entry.position_id === position.id);
              const short = unfilledCount(position, assignments);
              const role = roleName(position.role_id);
              const time = `${formatTime(position.starts_at)}–${formatTime(position.ends_at)}`;

              return (
                <div key={position.id}>
                  <div className="action-row flex items-center gap-3">
                    {/* aria-label rather than relying on the child text: the
                        role and the time ran together as "Operations07:00". */}
                    <button
                      type="button"
                      onClick={() => onEditPosition(position)}
                      aria-label={`${role}, ${time}. Edit this position.`}
                      className="min-h-11 min-w-0 flex-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
                    >
                      <span className="block truncate text-sm font-semibold" aria-hidden="true">
                        {role}
                      </span>
                      <span
                        className="mt-1 block truncate font-mono text-xs tabular-nums text-muted-foreground"
                        aria-hidden="true"
                      >
                        {time}
                        {position.notes && ` · ${position.notes}`}
                      </span>
                    </button>

                    <span
                      className={`shrink-0 font-mono text-xs tabular-nums ${
                        short > 0 ? "font-bold text-brand-danger" : "text-muted-foreground"
                      }`}
                    >
                      {filledBy.length}/{position.needed}
                    </span>

                    <Button
                      size="sm"
                      variant="ghost"
                      className="min-h-9 shrink-0"
                      onClick={() => onAssign(position)}
                      aria-label={`Add someone to ${role}`}
                    >
                      <UserPlus className="h-4 w-4" />
                      Add someone
                    </Button>
                  </div>

                  {filledBy.map((entry) => (
                    // Assignments hang off their position: same row rhythm, one
                    // indent, so a filled role reads as one block on the scan.
                    <div
                      key={entry.id}
                      className="action-row flex items-center gap-3 bg-[--st-panel-hi] pl-8"
                    >
                      <span className="min-w-0 flex-1 truncate text-xs">
                        {assignmentLabel(entry, people)}
                        {entry.notes && (
                          <span className="text-muted-foreground"> · {entry.notes}</span>
                        )}
                      </span>

                      <Button
                        size="sm"
                        variant="ghost"
                        className="min-h-9 shrink-0 px-2 text-xs text-muted-foreground"
                        onClick={() => onUnassign(entry)}
                        aria-label={`Remove ${assignmentLabel(entry, people)} from ${role}`}
                      >
                        <UserMinus className="h-3 w-3" />
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))
      )}
    </section>
  );
}
