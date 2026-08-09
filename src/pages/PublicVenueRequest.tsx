import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type RequestSpace = {
  id: string;
  name: string;
  description: string;
  capacity: number | null;
};

const LINK_DEAD = "This request link is no longer active.";

export default function PublicVenueRequest() {
  const { token } = useParams();

  const [spaces, setSpaces] = useState<RequestSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const [spaceId, setSpaceId] = useState("");
  const [title, setTitle] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const loadSpaces = async () => {
      setLoading(true);
      setError("");

      const { data, error: rpcError } = await (supabase as any).rpc("get_venue_request_spaces", {
        request_token: token || "",
      });

      if (rpcError || !data || (data as RequestSpace[]).length === 0) {
        setError(LINK_DEAD);
        setSpaces([]);
      } else {
        setSpaces(data as RequestSpace[]);
        setSpaceId((data as RequestSpace[])[0].id);
      }

      setLoading(false);
    };

    loadSpaces();
  }, [token]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!spaceId || !title.trim() || !name.trim() || !email.trim() || !startsAt || !endsAt) {
      setError("Please fill in the required fields.");
      return;
    }
    if (new Date(endsAt) <= new Date(startsAt)) {
      setError("The end time must be after the start time.");
      return;
    }

    setSubmitting(true);

    const { error: rpcError } = await (supabase as any).rpc("submit_venue_request", {
      request_token: token || "",
      target_space_id: spaceId,
      booking_title: title.trim(),
      hirer_name: name.trim(),
      hirer_email: email.trim(),
      hirer_phone: phone.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      request_notes: notes.trim(),
    });

    setSubmitting(false);

    if (rpcError) {
      setError(rpcError.message || "We could not send your request. Please try again.");
      return;
    }

    setSubmitted(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (spaces.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-muted-foreground">{LINK_DEAD}</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <CheckCircle2 className="h-10 w-10 text-primary" />
        <h1 className="text-xl font-semibold">Request sent</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Thank you. Someone will be in touch to confirm availability and cost.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Request a venue</h1>
        <p className="text-sm text-muted-foreground">
          Send your details and we will confirm availability and cost.
        </p>
      </div>

      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="request-space">
            Space
          </label>
          <select
            id="request-space"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={spaceId}
            onChange={(event) => setSpaceId(event.target.value)}
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
                {space.capacity ? ` (seats ${space.capacity})` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="request-title">
            What is it for?
          </label>
          <Input id="request-title" value={title} onChange={(event) => setTitle(event.target.value)} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-start">
              From
            </label>
            <Input
              id="request-start"
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-end">
              Until
            </label>
            <Input
              id="request-end"
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-name">
              Your name
            </label>
            <Input id="request-name" value={name} onChange={(event) => setName(event.target.value)} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-email">
              Email
            </label>
            <Input
              id="request-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="request-phone">
              Phone
            </label>
            <Input id="request-phone" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="request-notes">
            Anything we should know?
          </label>
          <Textarea
            id="request-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Sending…" : "Send request"}
        </Button>
      </form>
    </div>
  );
}
