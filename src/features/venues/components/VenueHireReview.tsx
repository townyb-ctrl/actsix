import { Badge } from "@/components/ui/badge";
import type { VenueHireStatus } from "@/features/venues/lib/venueHires";

type Props = {
  name: string;
  eventType: string;
  status: VenueHireStatus;
  hirerName: string;
  hirerEmail: string;
  hirerPhone: string;
  onsiteName: string;
  onsitePhone: string;
  paymentTerms: string;
  hirerNotes: string;
  notes: string;
};

const Row = ({
  label,
  children,
  missing,
}: {
  label: string;
  children: React.ReactNode;
  /** Nothing entered. Said plainly rather than left blank, so it reads as a
   *  choice somebody can still make rather than a field that failed to load. */
  missing?: boolean;
}) => (
  <div className="action-row flex items-start gap-3">
    <span className="w-32 shrink-0 pt-0.5 text-[13px] font-bold">{label}</span>
    <span className={`min-w-0 flex-1 text-sm ${missing ? "text-muted-foreground" : ""}`}>
      {children}
    </span>
  </div>
);

/**
 * What is about to exist, before it does.
 *
 * A hire ends up carrying rooms, a bond and a contract, and it used to come
 * into being the moment somebody pressed Save. This is the read-back: the same
 * row rhythm the hire itself uses, so the shape is familiar before the first
 * booking is added.
 */
export default function VenueHireReview({
  name,
  eventType,
  status,
  hirerName,
  hirerEmail,
  hirerPhone,
  onsiteName,
  onsitePhone,
  paymentTerms,
  hirerNotes,
  notes,
}: Props) {
  const contactLine = [hirerEmail, hirerPhone].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <section className="st-panel" aria-labelledby="hire-review-heading">
        <div className="st-panel-head">
          <h2 className="st-panel-title" id="hire-review-heading">
            Before this hire exists
          </h2>
          <Badge variant={status === "Confirmed" ? "default" : "secondary"}>{status}</Badge>
        </div>

        <Row label="Event">
          <span className="font-semibold">{name}</span>
          {eventType && <span className="text-muted-foreground"> · {eventType}</span>}
        </Row>

        <Row label="Hirer" missing={!hirerName}>
          {hirerName || "Nobody named yet"}
          {contactLine && (
            <span className="mt-0.5 block font-mono text-xs tabular-nums text-muted-foreground">
              {contactLine}
            </span>
          )}
        </Row>

        <Row label="On the day" missing={!onsiteName}>
          {onsiteName || "Nobody to call yet"}
          {onsitePhone && (
            <span className="mt-0.5 block font-mono text-xs tabular-nums text-muted-foreground">
              {onsitePhone}
            </span>
          )}
        </Row>

        <Row label="Payment terms" missing={!paymentTerms}>
          {paymentTerms || "None set"}
        </Row>

        {hirerNotes && (
          <Row label="They will read">
            <Badge
              variant="outline"
              className="border-brand-teal/25 bg-brand-teal/8 text-brand-teal"
            >
              On their page
            </Badge>
            <span className="mt-1.5 block whitespace-pre-wrap">{hirerNotes}</span>
          </Row>
        )}

        {notes && (
          <Row label="Only staff">
            <Badge
              variant="outline"
              className="border-brand-amber/30 bg-brand-amber/10 text-brand-amber"
            >
              Staff only
            </Badge>
            <span className="mt-1.5 block whitespace-pre-wrap">{notes}</span>
          </Row>
        )}
      </section>

      {/* Said here because the modal cannot book anything: leaving somebody to
          discover that their "booking" holds no room would be worse. */}
      <p className="text-xs text-muted-foreground">
        Nothing is booked yet. Creating this opens the hire, where you add the spaces and days, the
        quote and who is on. The calendar stays clear until you do.
      </p>
    </div>
  );
}
