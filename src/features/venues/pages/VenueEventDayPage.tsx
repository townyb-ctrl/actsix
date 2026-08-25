import { useState } from "react";
import { ArrowLeft, CheckCircle2, Phone, Radio, TriangleAlert } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { useNow } from "@/hooks/useNow";
import { useVenueHires } from "@/features/venues/api/venueHiresQueries";
import { useVenueBookings, useVenueSpaces } from "@/features/venues/api/venuesQueries";
import { useRunSheet } from "@/features/venues/api/venueRunSheetQueries";
import {
  usePositionAssignments,
  usePositionPeople,
  usePositionRoles,
  usePositions,
} from "@/features/venues/api/venuePositionsQueries";
import { useHireContacts } from "@/features/venues/api/venueSafetyQueries";
import { useTurnaroundTasks } from "@/features/venues/api/venueTurnaroundQueries";
import { setTurnaroundTaskDone } from "@/features/venues/api/venueTurnaroundApi";
import { hiresToday, itemsForDay, nowAndNext } from "@/features/venues/lib/venueEventDay";
import { assignmentLabel } from "@/features/venues/lib/venuePositions";
import { turnaroundProgress } from "@/features/venues/lib/venueTurnaround";
import VenueIncidentModal from "@/features/venues/components/VenueIncidentModal";

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

/** "in 25 min" / "in 2 h 10" — how long somebody actually has. */
const untilLabel = (iso: string, now: Date) => {
  const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `in ${hours} h ${String(minutes % 60).padStart(2, "0")}`;
};

/**
 * The day, for somebody holding a phone in a foyer.
 *
 * This is the desk's "On now" band opened up. It was built out of stock cards
 * before Studio landed and never came back for the sweep, so it read as a
 * different product from every other venue screen. Now it is the same
 * instrument: hairline rows, mono times down one column, one teal.
 *
 * What is running and what is next lead at full size, because the only
 * question worth answering while standing up is "what happens next and have I
 * got somebody on it".
 */
export default function VenueEventDayPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const [incidentOpen, setIncidentOpen] = useState(false);
  // Ticks, or "in 25 min" is frozen at whatever it said when the page opened -
  // on the one screen in the product whose entire job is the next half hour.
  const today = useNow();

  const { hires } = useVenueHires(workspace?.id);
  const { bookings } = useVenueBookings({ workspaceId: workspace?.id });
  const { spaces } = useVenueSpaces(workspace?.id);

  const running = hiresToday(hires, bookings, today);
  const selectedId = params.get("hire") || running[0]?.hire.id || null;
  const selected = running.find((entry) => entry.hire.id === selectedId) || null;

  const { items } = useRunSheet(selectedId);
  const { positions } = usePositions(selectedId);
  const { assignments } = usePositionAssignments(positions.map((position) => position.id));
  const { roles } = usePositionRoles(workspace?.id);
  const { people } = usePositionPeople(workspace?.id);
  const { contacts } = useHireContacts(selectedId);
  const { tasks } = useTurnaroundTasks(selectedId);

  const dayItems = itemsForDay(items, today);
  const { current, next } = nowAndNext(dayItems, today);
  const progress = turnaroundProgress(tasks);

  const spaceName = (spaceId: string | null) =>
    spaceId ? spaces.find((space) => space.id === spaceId)?.name || "Unknown space" : "Whole venue";

  const roleName = (roleId: string) => roles.find((role) => role.id === roleId)?.name || "Position";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-turnaround"] });
    queryClient.invalidateQueries({ queryKey: ["venue-incidents"] });
  };

  const tickTask = async (taskId: string, done: boolean) => {
    const { error } = await setTurnaroundTaskDone({ taskId, done, doneBy: user?.email || "" });
    if (error) {
      toast.error("Could not update the task", { description: error.message });
      return;
    }
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Today"
        subtitle={today.toLocaleDateString("en-ZA", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        actions={
          <Button variant="outline" className="min-h-10" asChild>
            <Link to="/venues">
              <ArrowLeft className="h-4 w-4" />
              Desk
            </Link>
          </Button>
        }
      />

      <div className="actsix-page-body space-y-3 pb-24">
        {running.length === 0 ? (
          <section className="st-panel">
            <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
              <CheckCircle2 className="h-7 w-7 text-[--st-green]" aria-hidden="true" />
              <p className="text-sm font-semibold">Nothing on today</p>
              <p className="text-xs text-muted-foreground">The building is yours.</p>
            </div>
          </section>
        ) : (
          <>
            {running.length > 1 && (
              <div
                role="tablist"
                aria-label="Hires in the building today"
                className="actsix-view-tabs flex w-full gap-1 overflow-x-auto"
              >
                {running.map((entry) => (
                  <button
                    key={entry.hire.id}
                    type="button"
                    role="tab"
                    aria-selected={entry.hire.id === selectedId}
                    data-state={entry.hire.id === selectedId ? "active" : "inactive"}
                    className="actsix-view-tab shrink-0"
                    onClick={() => setParams({ hire: entry.hire.id })}
                  >
                    <span className="truncate text-[13px] font-bold">{entry.hire.name}</span>
                  </button>
                ))}
              </div>
            )}

            {selected && (
              <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0 space-y-3">
                  {/* Now and next lead at full size. Everything below is
                      reference; this is the only part somebody reads while
                      walking. */}
                  <section className="st-panel" aria-labelledby="day-now-heading">
                    <div className="st-panel-head">
                      <h2 className="st-panel-title" id="day-now-heading">
                        Right now
                      </h2>
                      <span className="st-tally">{formatTime(today.toISOString())}</span>
                    </div>

                    {current.length === 0 ? (
                      <p className="px-4 py-5 text-sm text-muted-foreground">
                        Nothing running this minute.
                      </p>
                    ) : (
                      current.map((item) => (
                        <div key={item.id} className="action-row">
                          <p className="text-[1.0625rem] font-bold leading-tight">{item.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {spaceName(item.space_id)} · until{" "}
                            <span className="font-mono tabular-nums">
                              {formatTime(item.ends_at)}
                            </span>
                          </p>
                        </div>
                      ))
                    )}

                    {next && (
                      <div className="action-row bg-[--st-panel-hi]">
                        <p className="label-eyebrow">Next</p>
                        <p className="mt-1 text-sm font-semibold">{next.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          <span className="font-mono tabular-nums">
                            {formatTime(next.starts_at)}
                          </span>{" "}
                          · {untilLabel(next.starts_at, today)} · {spaceName(next.space_id)}
                        </p>
                      </div>
                    )}
                  </section>

                  <section className="st-panel" aria-labelledby="day-runsheet-heading">
                    <div className="st-panel-head">
                      <h2 className="st-panel-title" id="day-runsheet-heading">
                        Run sheet
                      </h2>
                      <span className="st-tally">{dayItems.length}</span>
                    </div>

                    {dayItems.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-muted-foreground">
                        Nothing scheduled today.
                      </p>
                    ) : (
                      dayItems.map((item) => {
                        const done = new Date(item.ends_at).getTime() < today.getTime();

                        return (
                          <div key={item.id} className="action-row flex items-start gap-3">
                            <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                              {formatTime(item.starts_at)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={cn(
                                  "block truncate text-sm font-semibold",
                                  done && "text-muted-foreground"
                                )}
                              >
                                {item.title}
                              </span>
                              <span className="mt-1 block truncate text-xs text-muted-foreground">
                                {spaceName(item.space_id)}
                                {item.av_notes && ` · ${item.av_notes}`}
                              </span>
                            </span>
                          </div>
                        );
                      })
                    )}
                  </section>
                </div>

                <aside className="space-y-3">
                  <section className="st-panel" aria-labelledby="day-where-heading">
                    <div className="st-panel-head">
                      <h2 className="st-panel-title" id="day-where-heading">
                        {selected.hire.name}
                      </h2>
                    </div>

                    {selected.bookings.map((booking) => (
                      <div key={booking.id} className="st-figure">
                        <span className="st-figure-label">{spaceName(booking.space_id)}</span>
                        <span className="st-figure-value" data-tone="quiet">
                          {formatTime(booking.starts_at)}–{formatTime(booking.ends_at)}
                        </span>
                      </div>
                    ))}

                    {selected.hire.walkie_channels && (
                      <div className="action-row flex items-start gap-2">
                        <Radio
                          className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <span className="text-xs">{selected.hire.walkie_channels}</span>
                      </div>
                    )}
                  </section>

                  <section className="st-panel" aria-labelledby="day-call-heading">
                    <div className="st-panel-head">
                      <h2 className="st-panel-title" id="day-call-heading">
                        Who to call
                      </h2>
                    </div>

                    {selected.hire.onsite_contact_name && (
                      <div className="action-row">
                        <p className="label-eyebrow">On site</p>
                        <p className="mt-1 text-sm font-semibold">
                          {selected.hire.onsite_contact_name}
                        </p>
                        {selected.hire.onsite_contact_phone && (
                          <a
                            href={`tel:${selected.hire.onsite_contact_phone}`}
                            className="mt-1 inline-flex min-h-9 items-center gap-1.5 font-mono text-xs tabular-nums underline"
                          >
                            <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                            {selected.hire.onsite_contact_phone}
                          </a>
                        )}
                      </div>
                    )}

                    {contacts.length === 0 && !selected.hire.onsite_contact_name ? (
                      <p className="px-4 py-4 text-sm text-[--st-rose]">
                        Nobody is listed. If something happens there is no number on this screen.
                      </p>
                    ) : (
                      contacts.map((contact) => (
                        <div key={contact.id} className="action-row">
                          <p className="text-sm font-semibold">{contact.name}</p>
                          {contact.role && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{contact.role}</p>
                          )}
                          {contact.phone && (
                            <a
                              href={`tel:${contact.phone}`}
                              className="mt-1 inline-flex min-h-9 items-center gap-1.5 font-mono text-xs tabular-nums underline"
                            >
                              <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                              {contact.phone}
                            </a>
                          )}
                        </div>
                      ))
                    )}
                  </section>

                  <section className="st-panel" aria-labelledby="day-roster-heading">
                    <div className="st-panel-head">
                      <h2 className="st-panel-title" id="day-roster-heading">
                        On today
                      </h2>
                      <span className="st-tally">{positions.length}</span>
                    </div>

                    {positions.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-muted-foreground">Nobody rostered.</p>
                    ) : (
                      positions.map((position) => {
                        const filled = assignments.filter(
                          (entry) => entry.position_id === position.id
                        );

                        return (
                          <div key={position.id} className="action-row">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="truncate text-sm font-semibold">
                                {roleName(position.role_id)}
                              </span>
                              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                                {formatTime(position.starts_at)}–{formatTime(position.ends_at)}
                              </span>
                            </div>
                            <p
                              className={cn(
                                "mt-1 truncate text-xs",
                                filled.length === 0
                                  ? "font-semibold text-[--st-rose]"
                                  : "text-muted-foreground"
                              )}
                            >
                              {filled.length === 0
                                ? "Nobody assigned"
                                : filled.map((entry) => assignmentLabel(entry, people)).join(", ")}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </section>

                  {tasks.length > 0 && (
                    <section className="st-panel" aria-labelledby="day-turnaround-heading">
                      <div className="st-panel-head">
                        <h2 className="st-panel-title" id="day-turnaround-heading">
                          Turnaround
                        </h2>
                        <span className="st-tally">
                          {progress.done}/{progress.total}
                        </span>
                      </div>

                      {tasks.map((task) => (
                        <label
                          key={task.id}
                          className="action-row flex cursor-pointer items-start gap-3"
                        >
                          <span className="-m-2 shrink-0 p-2">
                            <input
                              type="checkbox"
                              checked={task.done}
                              onChange={() => tickTask(task.id, !task.done)}
                              className="mt-1 h-5 w-5"
                            />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-sm",
                                task.done
                                  ? "text-muted-foreground line-through"
                                  : "font-semibold"
                              )}
                            >
                              {task.title}
                            </span>
                            <span className="mt-1 block truncate text-xs text-muted-foreground">
                              {spaceName(task.space_id)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </section>
                  )}
                </aside>
              </div>
            )}
          </>
        )}
      </div>

      {selected && (
        <>
          {/* The one action worth a permanent thumb-reachable button: an
              incident logged an hour later is a memory, not a record. */}
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[--st-line] bg-[--st-panel]/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
            <Button
              className="min-h-12 w-full"
              variant="destructive"
              onClick={() => setIncidentOpen(true)}
            >
              <TriangleAlert className="h-5 w-5" />
              Log an incident
            </Button>
          </div>

          <div className="actsix-page-body hidden pb-6 lg:block">
            <Button variant="destructive" className="min-h-10" onClick={() => setIncidentOpen(true)}>
              <TriangleAlert className="h-4 w-4" />
              Log an incident
            </Button>
          </div>

          <VenueIncidentModal
            open={incidentOpen}
            incident={null}
            spaces={spaces}
            hireId={selected.hire.id}
            workspaceId={workspace?.id || ""}
            userId={user?.id || ""}
            reportedBy={user?.email || ""}
            onOpenChange={setIncidentOpen}
            onSaved={refresh}
          />
        </>
      )}
    </div>
  );
}
