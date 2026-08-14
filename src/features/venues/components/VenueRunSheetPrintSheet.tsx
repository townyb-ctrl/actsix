import { createPortal } from "react-dom";

import type { VenueSpace } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import { runSheetByDay, type VenueRunSheetItem } from "@/features/venues/lib/venueRunSheet";
import {
  assignmentLabel,
  positionsByDay,
  type PositionPerson,
  type VenuePosition,
  type VenuePositionAssignment,
  type VenuePositionRole,
} from "@/features/venues/lib/venuePositions";

type Props = {
  workspaceName: string;
  logoUrl?: string | null;
  hire: VenueHire;
  items: VenueRunSheetItem[];
  spaces: VenueSpace[];
  positions: VenuePosition[];
  assignments: VenuePositionAssignment[];
  roles: VenuePositionRole[];
  people: PositionPerson[];
};

const formatDayHeading = (day: string) => {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

/**
 * The paper run sheet left at each tech and ops position.
 *
 * Same portal-on-body approach as MeetingPrintSheet, because printing hides
 * `#root` wholesale. Everything a person standing in a room needs is on it:
 * the times, the space, what to set up, what AV, which doors, and the risks -
 * plus the on-site contact to phone when something is not on the sheet.
 */
export default function VenueRunSheetPrintSheet({
  workspaceName,
  logoUrl,
  hire,
  items,
  spaces,
  positions,
  assignments,
  roles,
  people,
}: Props) {
  const days = runSheetByDay(items);
  const spaceName = (spaceId: string | null) =>
    spaceId ? spaces.find((space) => space.id === spaceId)?.name || "Unknown space" : "Whole venue";

  // Who is on that day, so the sheet left at a position also says who is
  // standing at the others.
  const staffByDay = new Map(
    positionsByDay(positions).map(({ day, positions: dayPositions }) => [day, dayPositions])
  );
  const roleName = (roleId: string) =>
    roles.find((role) => role.id === roleId)?.name || "Unknown role";

  return createPortal(
    <article className="actsix-print-sheet" aria-hidden>
      <header className="actsix-print-header">
        {logoUrl && <img src={logoUrl} alt="" className="actsix-print-logo" />}

        <div className="actsix-print-headings">
          <p className="actsix-print-org">{workspaceName}</p>
          <h1 className="actsix-print-title">Run sheet — {hire.name}</h1>
          {hire.event_type && <p className="actsix-print-meta">{hire.event_type}</p>}
        </div>
      </header>

      <section className="actsix-print-people">
        {hire.onsite_contact_name && (
          <p>
            <span className="actsix-print-people-label">On site</span>
            {hire.onsite_contact_name}
            {hire.onsite_contact_phone && ` · ${hire.onsite_contact_phone}`}
          </p>
        )}
        {hire.hirer_name && (
          <p>
            <span className="actsix-print-people-label">Hirer</span>
            {hire.hirer_name}
            {hire.hirer_phone && ` · ${hire.hirer_phone}`}
          </p>
        )}
      </section>

      <div className="actsix-print-body">
        {days.map(({ day, items: dayItems }) => (
          <section key={day} style={{ marginBottom: "18px", breakInside: "avoid" }}>
            <h2 style={{ fontSize: "13pt", margin: "0 0 6px" }}>{formatDayHeading(day)}</h2>

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {dayItems.map((item) => (
                  <tr key={item.id} style={{ breakInside: "avoid" }}>
                    <td
                      style={{
                        borderBottom: "1px solid #ddd",
                        padding: "6px 8px 6px 0",
                        verticalAlign: "top",
                        whiteSpace: "nowrap",
                        fontWeight: 700,
                      }}
                    >
                      {formatTime(item.starts_at)}
                      <br />
                      {formatTime(item.ends_at)}
                    </td>
                    <td style={{ borderBottom: "1px solid #ddd", padding: "6px 0", verticalAlign: "top" }}>
                      <strong>{item.title}</strong> — {spaceName(item.space_id)}
                      {item.setup_notes && (
                        <div>
                          <em>Setup:</em> {item.setup_notes}
                        </div>
                      )}
                      {item.av_notes && (
                        <div>
                          <em>AV:</em> {item.av_notes}
                        </div>
                      )}
                      {item.access_notes && (
                        <div>
                          <em>Access:</em> {item.access_notes}
                        </div>
                      )}
                      {item.risk_notes && (
                        <div>
                          <em>Watch:</em> {item.risk_notes}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {(staffByDay.get(day) ?? []).length > 0 && (
              <p style={{ margin: "6px 0 0", fontSize: "10pt" }}>
                <strong>On today: </strong>
                {(staffByDay.get(day) ?? [])
                  .map((position) => {
                    const names = assignments
                      .filter((entry) => entry.position_id === position.id)
                      .map((entry) => assignmentLabel(entry, people));

                    return `${roleName(position.role_id)} — ${
                      names.length > 0 ? names.join(", ") : "unfilled"
                    }`;
                  })
                  .join(" · ")}
              </p>
            )}
          </section>
        ))}

        {hire.notes && (
          <p style={{ marginTop: "12px" }}>
            <strong>Notes:</strong> {hire.notes}
          </p>
        )}
      </div>
    </article>,
    document.body
  );
}
