import { Plus, UserMinus, UserPlus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Positions</CardTitle>
          {positions.length > 0 && (
            <Badge variant={totalUnfilled > 0 ? "secondary" : "default"}>
              {totalUnfilled > 0 ? `${totalUnfilled} still to fill` : "Fully staffed"}
            </Badge>
          )}
        </div>

        <Button size="sm" variant="outline" onClick={() => onAddPosition()}>
          <Plus className="h-4 w-4" />
          Add position
        </Button>
      </CardHeader>

      <CardContent className="space-y-5">
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No positions yet. Add the roles this event needs — opener, tech, ops, car guards,
            cleaner, closer — and who is on each.
          </p>
        ) : (
          days.map(({ day, positions: dayPositions }) => (
            <section key={day} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="label-eyebrow">{formatDayHeading(day)}</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => onAddPosition(dayPositions[0]?.starts_at)}
                >
                  <Plus className="h-3 w-3" />
                  Add to this day
                </Button>
              </div>

              <div className="space-y-2">
                {dayPositions.map((position) => {
                  const filledBy = assignments.filter(
                    (entry) => entry.position_id === position.id
                  );
                  const short = unfilledCount(position, assignments);

                  return (
                    <div
                      key={position.id}
                      className="space-y-2 rounded-[0.75rem] border border-border/70 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => onEditPosition(position)}
                          className="min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
                        >
                          <span className="font-medium">{roleName(position.role_id)}</span>
                          <span className="ml-2 text-sm tabular-nums text-muted-foreground">
                            {formatTime(position.starts_at)}–{formatTime(position.ends_at)}
                          </span>
                          {position.notes && (
                            <span className="block text-sm text-muted-foreground">
                              {position.notes}
                            </span>
                          )}
                        </button>

                        <div className="flex items-center gap-2">
                          {short > 0 ? (
                            <Badge variant="secondary">
                              {filledBy.length}/{position.needed}
                            </Badge>
                          ) : (
                            <Badge variant="default">{position.needed} filled</Badge>
                          )}
                          <Button size="sm" variant="outline" onClick={() => onAssign(position)}>
                            <UserPlus className="h-4 w-4" />
                            Add someone
                          </Button>
                        </div>
                      </div>

                      {filledBy.length > 0 && (
                        <ul className="space-y-1">
                          {filledBy.map((entry) => (
                            <li
                              key={entry.id}
                              className="flex flex-wrap items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {assignmentLabel(entry, people)}
                                {entry.notes && (
                                  <span className="text-muted-foreground"> · {entry.notes}</span>
                                )}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs text-muted-foreground"
                                onClick={() => onUnassign(entry)}
                              >
                                <UserMinus className="h-3 w-3" />
                                Remove
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))
        )}
      </CardContent>
    </Card>
  );
}
