import { Badge } from "@/components/ui/badge";
import type { VenueHire } from "@/features/venues/lib/venueHires";

type Props = {
  hire: VenueHire;
};

/**
 * The two notes a hire carries, and who can read each.
 *
 * Which of them the hirer can see is the first thing to know about a note, so
 * it is stated on the note itself and never in a tooltip - somebody pasting
 * "they always run late" into the wrong box is a phone call nobody wants.
 */
export default function VenueHireNotes({ hire }: Props) {
  const hasAny = Boolean(hire.hirer_notes.trim() || hire.notes.trim());

  return (
    <section className="st-panel" aria-labelledby="hire-notes-heading">
      <div className="st-panel-head">
        <h2 className="st-panel-title" id="hire-notes-heading">
          Notes
        </h2>
      </div>

      {!hasAny ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          Nothing written. Notes live on the hire, under Edit hire.
        </p>
      ) : (
        <>
          {hire.hirer_notes.trim() && (
            <div className="action-row">
              <Badge
                variant="outline"
                className="border-brand-teal/25 bg-brand-teal/8 text-brand-teal"
              >
                They see this
              </Badge>
              <p className="mt-2 whitespace-pre-wrap text-sm">{hire.hirer_notes}</p>
            </div>
          )}

          {hire.notes.trim() && (
            <div className="action-row">
              <Badge
                variant="outline"
                className="border-brand-amber/30 bg-brand-amber/10 text-brand-amber"
              >
                Staff only
              </Badge>
              <p className="mt-2 whitespace-pre-wrap text-sm">{hire.notes}</p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
