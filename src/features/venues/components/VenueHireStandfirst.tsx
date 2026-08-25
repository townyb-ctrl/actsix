import { Phone } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/features/venues/lib/venueBookings";
import type { VenueHire } from "@/features/venues/lib/venueHires";

type Props = {
  hire: VenueHire;
  spaceNames: string[];
  /** Negative when the church has taken more than it charged. */
  outstanding: number;
  bondHeld: number;
};

const Fact = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="min-w-0">
    <p className="label-eyebrow">{label}</p>
    <div className="mt-1 min-w-0 text-[13px] leading-5">{children}</div>
  </div>
);

/**
 * Everything true about the hire regardless of what you came to do.
 *
 * This was four stacked cards down the right-hand side - hire facts, contacts,
 * notes, and a clash headline - which cost 18rem of every screen to say six
 * short things. As a band it says them in one row, and the page keeps the
 * width for the work.
 *
 * It does not repeat the dates. The page title's own subtitle already states
 * the range, the day count and how far off it is; printing that again forty
 * pixels below it spent the band's most valuable slot saying nothing, while the
 * room the hire actually occupies sat underneath it in grey. The room leads
 * now.
 *
 * Phone numbers dial. The reason somebody opens a hire while standing in the
 * building is usually that something needs saying out loud.
 */
export default function VenueHireStandfirst({
  hire,
  spaceNames,
  outstanding,
  bondHeld,
}: Props) {
  // Overpaid is not settled. `outstanding` goes negative when more came in than
  // was charged, and reading that as "Settled" told the desk the money was done
  // with while the hirer was still owed a refund - the one direction of error
  // that ends in a phone call from somebody who is right.
  const owedBack = outstanding < 0;

  return (
    <section className="st-panel" aria-label="This hire at a glance">
      <div className="st-standfirst">
        <Fact label="Where">
          {spaceNames.length > 0 ? (
            <span className="font-medium">{spaceNames.join(" · ")}</span>
          ) : (
            <span className="text-muted-foreground">No room booked</span>
          )}
        </Fact>

        <Fact label="Hirer">
          <span className="block truncate font-medium">{hire.hirer_name || "Not named"}</span>
          {hire.hirer_phone ? (
            <a
              href={`tel:${hire.hirer_phone}`}
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs tabular-nums underline"
            >
              <Phone className="h-3 w-3" aria-hidden="true" />
              {hire.hirer_phone}
            </a>
          ) : (
            hire.hirer_email && (
              <a href={`mailto:${hire.hirer_email}`} className="block truncate text-xs underline">
                {hire.hirer_email}
              </a>
            )
          )}
        </Fact>

        <Fact label="On site on the day">
          <span className="block truncate font-medium">
            {hire.onsite_contact_name || (
              <span className="text-[--st-rose]">Nobody named</span>
            )}
          </span>
          {hire.onsite_contact_phone && (
            <a
              href={`tel:${hire.onsite_contact_phone}`}
              className="mt-0.5 inline-flex items-center gap-1 font-mono text-xs tabular-nums underline"
            >
              <Phone className="h-3 w-3" aria-hidden="true" />
              {hire.onsite_contact_phone}
            </a>
          )}
        </Fact>

        <Fact label="Money">
          <span
            className={`font-mono tabular-nums ${
              outstanding !== 0 ? "font-bold text-[--st-rose]" : "font-medium"
            }`}
          >
            {outstanding > 0 && `${formatCurrency(outstanding)} owed`}
            {owedBack && `${formatCurrency(Math.abs(outstanding))} owed back`}
            {outstanding === 0 && "Settled"}
          </span>
          {bondHeld > 0 && (
            <span className="block font-mono text-xs tabular-nums text-muted-foreground">
              {formatCurrency(bondHeld)} bond held
            </span>
          )}
        </Fact>

        <Fact label="Status">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant={hire.status === "Confirmed" ? "default" : "secondary"}>
              {hire.status}
            </Badge>
            {hire.event_type && (
              <Badge variant="outline" className="font-normal">
                {hire.event_type}
              </Badge>
            )}
          </div>
          {hire.enquiry_id && (
            <Link
              to={`/venues/enquiries/${hire.enquiry_id}`}
              className="mt-1 block text-xs underline"
            >
              From an enquiry
            </Link>
          )}
        </Fact>
      </div>
    </section>
  );
}
