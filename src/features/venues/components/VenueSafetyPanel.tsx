import { useState } from "react";
import { AlertTriangle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  deleteHireContact,
  saveHireSafety,
  setIncidentResolved,
  upsertHireContact,
} from "@/features/venues/api/venueSafetyApi";
import type { VenueHire } from "@/features/venues/lib/venueHires";
import {
  incidentSummary,
  safetyGaps,
  sortIncidents,
  type VenueHireContact,
  type VenueIncident,
} from "@/features/venues/lib/venueSafety";

type Props = {
  hire: VenueHire;
  incidents: VenueIncident[];
  contacts: VenueHireContact[];
  workspaceId: string;
  userId: string;
  onAddIncident: () => void;
  onEditIncident: (incident: VenueIncident) => void;
  onChanged: () => void;
};

const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const fromLocalInput = (value: string) => (value ? new Date(value).toISOString() : null);

const formatWhen = (iso: string) =>
  new Date(iso).toLocaleString("en-ZA", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

export default function VenueSafetyPanel({
  hire,
  incidents,
  contacts,
  workspaceId,
  userId,
  onAddIncident,
  onEditIncident,
  onChanged,
}: Props) {
  const [securityRequired, setSecurityRequired] = useState(hire.security_required);
  const [provider, setProvider] = useState(hire.security_provider);
  const [from, setFrom] = useState(toLocalInput(hire.security_from));
  const [to, setTo] = useState(toLocalInput(hire.security_to));
  const [carGuards, setCarGuards] = useState(hire.car_guards_required);
  const [guardCount, setGuardCount] = useState(String(hire.car_guard_count));
  const [accessPlan, setAccessPlan] = useState(hire.access_plan);
  const [saving, setSaving] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", role: "", phone: "" });

  const gaps = safetyGaps(hire, contacts);
  const summary = incidentSummary(incidents);
  const ordered = sortIncidents(incidents);

  const saveSecurity = async () => {
    setSaving(true);
    const { error } = await saveHireSafety(hire.id, {
      security_required: securityRequired,
      security_provider: provider.trim(),
      security_from: securityRequired ? fromLocalInput(from) : null,
      security_to: securityRequired ? fromLocalInput(to) : null,
      car_guards_required: carGuards,
      car_guard_count: Math.max(0, Number(guardCount) || 0),
      access_plan: accessPlan.trim(),
    });
    setSaving(false);

    if (error) {
      toast.error("Could not save the security plan", { description: error.message });
      return;
    }
    toast.success("Security plan saved");
    onChanged();
  };

  const addContact = async () => {
    if (!newContact.name.trim()) {
      toast.error("Give the contact a name");
      return;
    }

    const { error } = await upsertHireContact({
      workspaceId,
      hireId: hire.id,
      userId,
      payload: {
        name: newContact.name.trim(),
        role: newContact.role.trim(),
        phone: newContact.phone.trim(),
        sort_order: contacts.length,
      },
    });

    if (error) {
      toast.error("Could not add the contact", { description: error.message });
      return;
    }
    setNewContact({ name: "", role: "", phone: "" });
    onChanged();
  };

  const removeContact = async (contact: VenueHireContact) => {
    const { error } = await deleteHireContact(contact.id);
    if (error) {
      toast.error("Could not remove the contact", { description: error.message });
      return;
    }
    onChanged();
  };

  const toggleResolved = async (incident: VenueIncident) => {
    const { error } = await setIncidentResolved(incident.id, !incident.resolved);
    if (error) {
      toast.error("Could not update the incident", { description: error.message });
      return;
    }
    onChanged();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-base">Safety &amp; security</CardTitle>
          {summary.open > 0 && (
            <Badge variant={summary.needsAttention > 0 ? "destructive" : "secondary"}>
              {summary.open} open
            </Badge>
          )}
        </div>

        <Button size="sm" variant="outline" onClick={onAddIncident}>
          <Plus className="h-4 w-4" />
          Log incident
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {gaps.length > 0 && (
          <ul className="space-y-1 rounded-[var(--radius-control)] border border-brand-amber/30 bg-brand-amber/5 p-2.5 text-sm">
            {gaps.map((gap) => (
              <li key={gap} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-amber" />
                {gap}
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={securityRequired}
              onChange={(event) => setSecurityRequired(event.target.checked)}
            />
            Security guards needed
          </label>

          {securityRequired && (
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="space-y-1 sm:col-span-3">
                <span className="label-eyebrow">Provider</span>
                <Input value={provider} onChange={(event) => setProvider(event.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="label-eyebrow">From</span>
                <Input
                  type="datetime-local"
                  value={from}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </label>
              <label className="space-y-1">
                <span className="label-eyebrow">To</span>
                <Input
                  type="datetime-local"
                  value={to}
                  onChange={(event) => setTo(event.target.value)}
                />
              </label>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={carGuards}
              onChange={(event) => setCarGuards(event.target.checked)}
            />
            Car guards needed
          </label>

          {carGuards && (
            <label className="block max-w-32 space-y-1">
              <span className="label-eyebrow">How many</span>
              <Input
                type="number"
                min="0"
                value={guardCount}
                onChange={(event) => setGuardCount(event.target.value)}
              />
            </label>
          )}

          <label className="block space-y-1">
            <span className="label-eyebrow">Who gets in, and how</span>
            <Textarea
              value={accessPlan}
              onChange={(event) => setAccessPlan(event.target.value)}
              placeholder="Which doors are unlocked, who holds keys, who is turned away"
              className="min-h-16"
            />
          </label>

          <Button size="sm" className="actsix-btn-primary" onClick={saveSecurity} disabled={saving}>
            {saving ? "Saving…" : "Save security plan"}
          </Button>
        </div>

        <div className="space-y-2 border-t pt-3">
          <span className="label-eyebrow">Who to call on the day</span>

          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody listed yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {contacts.map((contact) => (
                <li key={contact.id} className="flex items-center justify-between gap-2">
                  <span>
                    <span className="font-medium">{contact.name}</span>
                    {contact.role && <span className="text-muted-foreground"> · {contact.role}</span>}
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} className="block text-muted-foreground underline">
                        {contact.phone}
                      </a>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeContact(contact)}
                    aria-label={`Remove ${contact.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input
              value={newContact.name}
              onChange={(event) => setNewContact({ ...newContact, name: event.target.value })}
              placeholder="Name"
            />
            <Input
              value={newContact.role}
              onChange={(event) => setNewContact({ ...newContact, role: event.target.value })}
              placeholder="Role"
            />
            <Input
              value={newContact.phone}
              onChange={(event) => setNewContact({ ...newContact, phone: event.target.value })}
              placeholder="Phone"
            />
            <Button size="sm" variant="outline" onClick={addContact}>
              Add
            </Button>
          </div>
        </div>

        <div className="space-y-2 border-t pt-3">
          <span className="label-eyebrow">Incidents</span>

          {ordered.length === 0 ? (
            <p className="flex items-start gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-sage" />
              Nothing logged.
            </p>
          ) : (
            <ul className="space-y-2">
              {ordered.map((incident) => (
                <li key={incident.id} className="flex items-start gap-2.5">
                  <span className="-m-2 shrink-0 p-2">
                    <input
                      type="checkbox"
                      checked={incident.resolved}
                      onChange={() => toggleResolved(incident)}
                      aria-label={`Mark ${incident.summary} resolved`}
                      className="mt-1 h-5 w-5"
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => onEditIncident(incident)}
                    className="min-h-11 flex-1 rounded px-1 py-1 text-left text-sm transition hover:bg-muted/40 active:scale-[0.995] motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
                  >
                    <span
                      className={cn(
                        "font-medium",
                        incident.resolved && "text-muted-foreground line-through"
                      )}
                    >
                      {incident.summary}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {incident.severity} · {incident.category} · {formatWhen(incident.occurred_at)}
                      {incident.reported_by && ` · ${incident.reported_by}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
