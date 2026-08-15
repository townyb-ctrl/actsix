import { useState } from "react";
import { ArrowLeft, CheckCircle2, Phone, Radio, TriangleAlert } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/PageHeader";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
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

export default function VenueEventDayPage() {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();

  const [incidentOpen, setIncidentOpen] = useState(false);
  const today = new Date();

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

  const roleName = (roleId: string) =>
    roles.find((role) => role.id === roleId)?.name || "Position";

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["venue-turnaround"] });
    queryClient.invalidateQueries({ queryKey: ["venue-incidents"] });
  };

  const tickTask = async (taskId: string, done: boolean) => {
    const { error } = await setTurnaroundTaskDone({
      taskId,
      done,
      doneBy: user?.email || "",
    });
    if (error) {
      toast.error("Could not update the task", { description: error.message });
      return;
    }
    refresh();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Venue Hire"
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
              Bookings
            </Link>
          </Button>
        }
      />

      <div className="actsix-page-body actsix-page-stack pb-24">
        {running.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-8 w-8 text-brand-sage" />
              <p className="font-medium">Nothing on today</p>
              <p className="text-sm text-muted-foreground">The building is yours.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {running.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {running.map((entry) => (
                  <Button
                    key={entry.hire.id}
                    size="sm"
                    variant={entry.hire.id === selectedId ? "default" : "outline"}
                    onClick={() => setParams({ hire: entry.hire.id })}
                  >
                    {entry.hire.name}
                  </Button>
                ))}
              </div>
            )}

            {selected && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{selected.hire.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {selected.bookings.map((booking) => (
                      <p key={booking.id}>
                        <span className="font-medium">{spaceName(booking.space_id)}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          {formatTime(booking.starts_at)}–{formatTime(booking.ends_at)}
                        </span>
                      </p>
                    ))}

                    {selected.hire.onsite_contact_name && (
                      <p className="flex items-center gap-2 pt-1">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {selected.hire.onsite_contact_name}
                          {selected.hire.onsite_contact_phone && (
                            <a
                              href={`tel:${selected.hire.onsite_contact_phone}`}
                              className="ml-2 underline"
                            >
                              {selected.hire.onsite_contact_phone}
                            </a>
                          )}
                        </span>
                      </p>
                    )}

                    {selected.hire.walkie_channels && (
                      <p className="flex items-center gap-2">
                        <Radio className="h-4 w-4 text-muted-foreground" />
                        {selected.hire.walkie_channels}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Right now</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {current.length === 0 ? (
                      <p className="text-muted-foreground">Nothing running.</p>
                    ) : (
                      current.map((item) => (
                        <p key={item.id}>
                          <span className="font-medium">{item.title}</span>
                          <span className="block text-muted-foreground">
                            {spaceName(item.space_id)} · until {formatTime(item.ends_at)}
                          </span>
                        </p>
                      ))
                    )}

                    {next && (
                      <p className="border-t pt-2">
                        <span className="label-eyebrow">Next</span>
                        <span className="block font-medium">{next.title}</span>
                        <span className="block text-muted-foreground">
                          {formatTime(next.starts_at)} · {spaceName(next.space_id)}
                        </span>
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Run sheet</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dayItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nothing scheduled today.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {dayItems.map((item) => (
                          <li key={item.id} className="flex gap-3">
                            <span className="w-12 shrink-0 tabular-nums text-muted-foreground">
                              {formatTime(item.starts_at)}
                            </span>
                            <span>
                              <span className="font-medium">{item.title}</span>
                              <span className="block text-xs text-muted-foreground">
                                {spaceName(item.space_id)}
                                {item.av_notes && ` · ${item.av_notes}`}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">On today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {positions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nobody rostered.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {positions.map((position) => {
                          const filled = assignments.filter(
                            (entry) => entry.position_id === position.id
                          );

                          return (
                            <li key={position.id}>
                              <span className="font-medium">{roleName(position.role_id)}</span>
                              <span className="text-muted-foreground">
                                {" "}
                                {formatTime(position.starts_at)}–{formatTime(position.ends_at)}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {filled.length === 0
                                  ? "Nobody assigned"
                                  : filled.map((entry) => assignmentLabel(entry, people)).join(", ")}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                {contacts.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">Who to call</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        {contacts.map((contact) => (
                          <li key={contact.id}>
                            <span className="font-medium">{contact.name}</span>
                            {contact.role && (
                              <span className="text-muted-foreground"> · {contact.role}</span>
                            )}
                            {contact.phone && (
                              <a
                                href={`tel:${contact.phone}`}
                                className="block text-brand-teal underline"
                              >
                                {contact.phone}
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {tasks.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-base">Turnaround</CardTitle>
                      <Badge variant={progress.allDone ? "default" : "secondary"}>
                        {progress.done}/{progress.total}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        {tasks.map((task) => (
                          <li key={task.id} className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={task.done}
                              onChange={() => tickTask(task.id, !task.done)}
                              aria-label={`Mark ${task.title} done`}
                              className="mt-1 h-5 w-5 shrink-0"
                            />
                            <span className={cn(task.done && "text-muted-foreground line-through")}>
                              {task.title}
                              <span className="block text-xs text-muted-foreground">
                                {spaceName(task.space_id)}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>

      {selected && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 backdrop-blur">
            <Button
              className="min-h-12 w-full"
              variant="destructive"
              onClick={() => setIncidentOpen(true)}
            >
              <TriangleAlert className="h-5 w-5" />
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
