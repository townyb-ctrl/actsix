import { createPortal } from "react-dom";
import { renderMinutesHtml } from "@/features/meetings/lib/meetingMinutes";

export type MeetingPrintSheetProps = {
  workspaceName: string;
  logoUrl?: string | null;
  title: string;
  date?: string | null;
  time?: string | null;
  location?: string | null;
  attendees: string[];
  apologies: string[];
  notes?: string | null;
};

const formatPrintDate = (date?: string | null) => {
  if (!date) return "";

  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/**
 * The printable minutes document.
 *
 * Rendered into a portal on `document.body` rather than inside the app tree,
 * because printing hides `#root` wholesale - a sheet living inside the page
 * would be hidden along with the page it's escaping from. It is `display: none`
 * on screen and only ever appears in print media (see `.actsix-print-sheet`
 * in index.css).
 *
 * The minutes body goes through the same renderMinutesHtml the on-screen
 * editor uses, so what gets circulated matches what was written.
 */
export function MeetingPrintSheet({
  workspaceName,
  logoUrl,
  title,
  date,
  time,
  location,
  attendees,
  apologies,
  notes,
}: MeetingPrintSheetProps) {
  const meta = [formatPrintDate(date), time, location].filter(Boolean).join("  ·  ");

  return createPortal(
    <article className="actsix-print-sheet" aria-hidden>
      <header className="actsix-print-header">
        {logoUrl && <img src={logoUrl} alt="" className="actsix-print-logo" />}

        <div className="actsix-print-headings">
          <p className="actsix-print-org">{workspaceName}</p>
          <h1 className="actsix-print-title">{title}</h1>
          {meta && <p className="actsix-print-meta">{meta}</p>}
        </div>
      </header>

      {(attendees.length > 0 || apologies.length > 0) && (
        <section className="actsix-print-people">
          {attendees.length > 0 && (
            <p>
              <span className="actsix-print-people-label">Present</span>
              {attendees.join(", ")}
            </p>
          )}
          {apologies.length > 0 && (
            <p>
              <span className="actsix-print-people-label">Apologies</span>
              {apologies.join(", ")}
            </p>
          )}
        </section>
      )}

      {notes ? (
        <div
          className="minutes-document actsix-print-body"
          dangerouslySetInnerHTML={{ __html: renderMinutesHtml(notes) }}
        />
      ) : (
        <p className="actsix-print-body">No minutes were written for this meeting.</p>
      )}
    </article>,
    document.body
  );
}
