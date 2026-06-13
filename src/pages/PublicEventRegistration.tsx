import { FormEvent, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PublicFormData = {
  form: {
    title: string;
    settings: Record<string, any>;
  };
  event: {
    title: string;
    starts_at?: string | null;
    location?: string;
    cost_per_person?: number;
  };
};

const formatEventDate = (value?: string | null) => {
  if (!value) return "";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function PublicEventRegistration() {
  const { token } = useParams();
  const [data, setData] = useState<PublicFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/event-registration-hosted-form?token=${token || ""}&format=json`;

  useEffect(() => {
    const loadForm = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(functionUrl);
        const body = await response.json();
        if (!response.ok) throw new Error(body?.error || "This registration form is not available.");
        setData(body);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "This registration form is not available.");
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [functionUrl]);

  const submitRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    try {
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error || "Could not submit registration.");
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit registration.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PublicShell><div className="actsix-empty-state min-h-48 text-sm">Loading registration form...</div></PublicShell>;
  }

  if (error && !data) {
    return <PublicShell><div className="actsix-empty-state min-h-48 text-sm">{error}</div></PublicShell>;
  }

  if (submitted) {
    return (
      <PublicShell>
        <section className="rounded-2xl border border-border/70 bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-sage/10 text-brand-sage">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">Registration received</h1>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-6 text-muted-foreground">
            Thank you. The event team will follow up if approval, payment, or extra information is needed.
          </p>
        </section>
      </PublicShell>
    );
  }

  const event = data?.event;
  const cost = Number(event?.cost_per_person || 0);

  return (
    <PublicShell>
      <section className="rounded-2xl border border-brand-teal/15 bg-gradient-to-br from-brand-teal/10 via-card to-background p-5 shadow-sm">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-brand-teal">ACTSIX Event Registration</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">{event?.title || "Event registration"}</h1>
        <div className="mt-4 flex flex-wrap gap-2">
          {event?.location && <span className="rounded-full border border-brand-teal/20 bg-card px-3 py-1.5 text-sm font-extrabold text-muted-foreground">{event.location}</span>}
          {event?.starts_at && <span className="rounded-full border border-brand-teal/20 bg-card px-3 py-1.5 text-sm font-extrabold text-muted-foreground">{formatEventDate(event.starts_at)}</span>}
          <span className="rounded-full border border-brand-teal/20 bg-card px-3 py-1.5 text-sm font-extrabold text-muted-foreground">
            {cost > 0 ? `Cost: R${cost.toLocaleString("en-ZA")}` : "No payment required at registration"}
          </span>
        </div>
      </section>

      <form onSubmit={submitRegistration} className="mt-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
        {error && <div className="mb-3 rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm font-bold text-destructive">{error}</div>}
        <Field label="Participant full name" name="name" required autoComplete="name" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field label="Mobile" name="mobile" autoComplete="tel" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Parent / guardian name" name="guardian_name" autoComplete="name" />
          <Field label="Parent / guardian email" name="guardian_email" type="email" autoComplete="email" />
        </div>
        <Field label="Emergency contact" name="emergency_contact" />
        <label className="mt-3 block text-sm font-extrabold text-muted-foreground">
          Notes
          <Textarea name="notes" rows={4} className="mt-2 rounded-xl bg-background" />
        </label>
        <label className="mt-4 flex gap-3 rounded-xl border border-brand-teal/15 bg-brand-teal/5 p-3 text-sm font-bold leading-6 text-muted-foreground">
          <input name="consent" type="checkbox" value="yes" className="mt-1 h-4 w-4 accent-brand-teal" />
          <span>I confirm consent for this registration and understand the event team may contact me for follow-up information.</span>
        </label>
        <Button type="submit" className="actsix-btn-primary mt-4 h-11 w-full rounded-full" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit registration"}
        </Button>
        <p className="mt-3 text-xs font-semibold leading-5 text-muted-foreground">
          Your registration will be sent to the event team in ACTSIX. If approval or payment is required, they will follow up with the next step.
        </p>
      </form>
    </PublicShell>
  );
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f4ee] px-4 py-8 text-foreground">
      <div className="mx-auto max-w-3xl">{children}</div>
    </main>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  autoComplete,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="mt-3 block text-sm font-extrabold text-muted-foreground">
      {label}
      <Input name={name} type={type} required={required} autoComplete={autoComplete} className="mt-2 rounded-xl bg-background" />
    </label>
  );
}
