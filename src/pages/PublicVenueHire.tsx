import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/features/venues/lib/venueBookings";
import { lineTotal } from "@/features/venues/lib/venueQuotes";
import {
  awaitingAnswer,
  portalBalance,
  type PortalPayload,
} from "@/features/venues/lib/venuePortal";

const LINK_DEAD = "This link is no longer active.";

const GENERIC_ERROR = "Something went wrong. Please try again.";

// Exactly the messages the portal functions raise
// (supabase/migrations/20260814220000_create_venue_hire_portal.sql). Any other
// error text is discarded so Postgres internals never reach an anonymous visitor.
const SAFE_ERRORS = new Set([
  LINK_DEAD,
  "Choose whether you are accepting or declining.",
  "Please type your name to accept.",
  "This quote is not waiting for an answer.",
]);

const formatRange = (startsAt: string, endsAt: string) => {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const time = (value: Date) =>
    value.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", hour12: false });

  return `${start.toLocaleDateString("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })} · ${time(start)}–${time(end)}`;
};

export default function PublicVenueHire() {
  const { token } = useParams();
  const [payload, setPayload] = useState<PortalPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [signedBy, setSignedBy] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [answered, setAnswered] = useState<"Accepted" | "Declined" | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error: rpcError } = await (supabase as any).rpc("get_venue_hire_portal", {
      portal_token: token,
    });
    setLoading(false);

    if (rpcError) {
      setError(SAFE_ERRORS.has(rpcError.message) ? rpcError.message : LINK_DEAD);
      return;
    }

    setPayload(data as PortalPayload);
  };

  useEffect(() => {
    load();
    // The token is the whole identity of this page; nothing else can change it.
  }, [token]);

  const respond = async (event: FormEvent, decision: "Accepted" | "Declined") => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    const { error: rpcError } = await (supabase as any).rpc("respond_to_venue_quote", {
      portal_token: token,
      decision,
      signed_by: signedBy,
    });
    setSubmitting(false);

    if (rpcError) {
      setError(SAFE_ERRORS.has(rpcError.message) ? rpcError.message : GENERIC_ERROR);
      return;
    }

    setAnswered(decision);
    load();
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    );
  }

  if (!payload) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-xl font-semibold">{error || LINK_DEAD}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Please get in touch with the church office for a new link.
        </p>
      </main>
    );
  }

  const balance = portalBalance(payload);
  const canAnswer = awaitingAnswer(payload);

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
      <header className="space-y-1">
        <p className="label-eyebrow">{payload.workspace?.name || "Venue hire"}</p>
        <h1 className="text-2xl font-semibold">{payload.hire.name}</h1>
        <p className="text-sm text-muted-foreground">
          For {payload.hire.hirer_name || "your organisation"}
        </p>
      </header>

      {answered && (
        <div className="flex items-start gap-2 rounded-lg border border-brand-sage/30 bg-brand-sage/10 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage" />
          <span>
            Thank you — we have recorded that you {answered === "Accepted" ? "accepted" : "declined"}{" "}
            this quote. The church office will be in touch.
          </span>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Your dates</h2>
        {payload.bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No dates are confirmed yet.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {payload.bookings.map((booking) => (
              <li key={`${booking.starts_at}-${booking.space_name}`}>
                <span className="font-medium">{booking.space_name || "Venue"}</span>
                <span className="block text-muted-foreground">
                  {formatRange(booking.starts_at, booking.ends_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Your quote</h2>
        {payload.quote_lines.length === 0 ? (
          <p className="text-sm text-muted-foreground">No costs have been added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {payload.quote_lines.map((line, index) => (
                <tr key={`${line.description}-${index}`} className="border-b last:border-0">
                  <td className="py-2">
                    {line.description || line.kind}
                    {line.quantity !== 1 && (
                      <span className="text-muted-foreground"> × {line.quantity}</span>
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">{formatCurrency(lineTotal(line))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <dl className="space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Total</dt>
            <dd className="tabular-nums">{formatCurrency(balance.charged)}</dd>
          </div>
          {balance.received !== 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Received</dt>
              <dd className="tabular-nums">{formatCurrency(balance.received)}</dd>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <dt>Outstanding</dt>
            <dd className="tabular-nums">{formatCurrency(balance.outstanding)}</dd>
          </div>
          {balance.dueNow > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <dt>Deposit to secure the date</dt>
              <dd className="tabular-nums">{formatCurrency(balance.dueNow)}</dd>
            </div>
          )}
        </dl>

        {payload.hire.payment_terms && (
          <p className="text-sm text-muted-foreground">{payload.hire.payment_terms}</p>
        )}
      </section>

      {payload.hire.contract_clauses && (
        <section className="space-y-2">
          <h2 className="text-base font-semibold">Terms</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {payload.hire.contract_clauses}
          </p>
        </section>
      )}

      {canAnswer ? (
        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="text-base font-semibold">Do you accept this quote?</h2>
          <form className="space-y-3" onSubmit={(event) => respond(event, "Accepted")}>
            <div className="space-y-1">
              <Label htmlFor="signed-by">Your name</Label>
              <Input
                id="signed-by"
                value={signedBy}
                onChange={(event) => setSignedBy(event.target.value)}
                placeholder="Who is agreeing to this"
              />
            </div>

            {error && <p className="text-sm text-brand-danger">{error}</p>}

            <div className="flex flex-wrap gap-2">
              <Button type="submit" className="actsix-btn-primary" disabled={submitting}>
                {submitting ? "Sending…" : "Accept"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={(event) => respond(event, "Declined")}
              >
                Decline
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Typing your name records your agreement. A signed paper copy may still be requested.
            </p>
          </form>
        </section>
      ) : (
        payload.hire.contract_signed_by && (
          <p className="text-sm text-muted-foreground">
            Accepted by {payload.hire.contract_signed_by}
            {payload.hire.contract_signed_on && ` on ${payload.hire.contract_signed_on}`}.
          </p>
        )
      )}
    </main>
  );
}
