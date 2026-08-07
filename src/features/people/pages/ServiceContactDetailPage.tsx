import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, Phone, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { useConfirm } from "@/hooks/useConfirm";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import ServiceContactEditorModal, {
  type ServiceContactDraft,
} from "@/features/people/components/ServiceContactEditorModal";
import { uploadServiceContactPhoto } from "@/features/people/lib/uploadServiceContactPhoto";
import type { ServiceContact } from "@/features/people/pages/ServiceContactsPage";

type ServiceContactLog = {
  id: string;
  contact_id: string;
  used_at: string;
  description: string;
  created_at: string;
};

const formatDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const todayDateInput = () => new Date().toISOString().slice(0, 10);

const ServiceContactDetailPage = () => {
  const { contactId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const { confirmAction, confirmDialog } = useConfirm();

  const [contact, setContact] = useState<ServiceContact | null>(null);
  const [logs, setLogs] = useState<ServiceContactLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingContact, setEditingContact] = useState<ServiceContactDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [logDate, setLogDate] = useState(todayDateInput());
  const [logDescription, setLogDescription] = useState("");
  const [savingLog, setSavingLog] = useState(false);

  const load = async () => {
    if (!contactId) return;

    setLoading(true);

    const [{ data: contactData, error: contactError }, { data: logData, error: logError }] = await Promise.all([
      (supabase as any).from("service_contacts").select("*").eq("id", contactId).maybeSingle(),
      (supabase as any)
        .from("service_contact_logs")
        .select("*")
        .eq("contact_id", contactId)
        .order("used_at", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    if (contactError) toast.error(friendlyErrorMessage(contactError));
    if (logError) toast.error(friendlyErrorMessage(logError));

    setContact(contactData || null);
    setLogs(logData || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [contactId]);

  const openEditContact = () => {
    if (!contact) return;

    setEditingContact({
      id: contact.id,
      name: contact.name,
      category: contact.category,
      phone: contact.phone,
      email: contact.email,
      address: contact.address,
      notes: contact.notes,
      photo_url: contact.photo_url,
    });
  };

  const handlePhotoSelected = async (file: File) => {
    if (!editingContact || !workspace || !user) return;

    setUploadingPhoto(true);
    const result = await uploadServiceContactPhoto({ file, workspaceId: workspace.id, userId: user.id });
    setUploadingPhoto(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    setEditingContact({ ...editingContact, photo_url: result.url });
  };

  const saveContact = async () => {
    if (!editingContact || !contact || !editingContact.name.trim()) return;

    setSaving(true);

    const { error } = await (supabase as any)
      .from("service_contacts")
      .update({
        name: editingContact.name.trim(),
        category: editingContact.category.trim(),
        phone: editingContact.phone.trim(),
        email: editingContact.email.trim(),
        address: editingContact.address.trim(),
        notes: editingContact.notes.trim(),
        photo_url: editingContact.photo_url,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact.id);

    setSaving(false);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    toast.success("Contact updated");
    setEditingContact(null);
    load();
  };

  const deleteContact = async () => {
    if (!contact) return;

    const confirmed = await confirmAction(
      `Delete "${contact.name}"? Its usage history will be removed too. This can't be undone.`
    );
    if (!confirmed) return;

    const { error } = await (supabase as any).from("service_contacts").delete().eq("id", contact.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    toast.success("Contact deleted");
    navigate("/people/contacts");
  };

  // Keeps the contact's "last used" summary in sync with its log history -
  // the newest remaining entry's date, or null once the log is empty.
  const syncLastUsed = async (remainingLogs: ServiceContactLog[]) => {
    if (!contact) return;

    const nextLastUsed = remainingLogs[0]?.used_at || null;
    if (nextLastUsed === contact.last_used_at) return;

    const { error } = await (supabase as any)
      .from("service_contacts")
      .update({ last_used_at: nextLastUsed })
      .eq("id", contact.id);

    if (!error) {
      setContact({ ...contact, last_used_at: nextLastUsed });
    }
  };

  const addLog = async (event: FormEvent) => {
    event.preventDefault();

    if (!contact || !workspace || !user || !logDate) return;

    setSavingLog(true);

    const { data, error } = await (supabase as any)
      .from("service_contact_logs")
      .insert({
        contact_id: contact.id,
        workspace_id: workspace.id,
        user_id: user.id,
        used_at: logDate,
        description: logDescription.trim(),
      })
      .select()
      .single();

    setSavingLog(false);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    const nextLogs = [data, ...logs].sort((a, b) => (a.used_at < b.used_at ? 1 : -1));
    setLogs(nextLogs);
    setLogDescription("");
    setLogDate(todayDateInput());
    toast.success("Logged");
    syncLastUsed(nextLogs);
  };

  const deleteLog = async (log: ServiceContactLog) => {
    const confirmed = await confirmAction("Delete this log entry? This can't be undone.");
    if (!confirmed) return;

    const { error } = await (supabase as any).from("service_contact_logs").delete().eq("id", log.id);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    const nextLogs = logs.filter((entry) => entry.id !== log.id);
    setLogs(nextLogs);
    syncLastUsed(nextLogs);
  };

  const categorySuggestion = useMemo(() => (contact?.category ? [contact.category] : []), [contact]);

  if (loading) {
    return (
      <div className="actsix-page-body pt-8">
        <div className="actsix-loading-state" role="status">
          Loading contact...
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="actsix-page-body pt-8">
        <Card className="actsix-panel p-5 text-center">
          <h2 className="text-lg font-extrabold tracking-tight">Contact not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">It may have been deleted.</p>
          <Link to="/people/contacts" className="actsix-btn-outline mt-4 inline-flex min-h-10 items-center gap-2 px-4">
            <ArrowLeft className="h-4 w-4" />
            Back to Service Contacts
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="People · Service Contacts"
        title={contact.name}
        subtitle={contact.category || undefined}
        actions={
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" className="actsix-btn-outline min-h-10" onClick={openEditContact}>
              Edit
            </Button>
            <Button
              type="button"
              variant="outline"
              className="actsix-btn-outline min-h-10 text-destructive hover:bg-destructive/10"
              onClick={deleteContact}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        }
      />

      <div className="actsix-page-body actsix-page-stack">
        <Link to="/people/contacts" className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-brand-teal">
          <ArrowLeft className="h-3.5 w-3.5" />
          All Service Contacts
        </Link>

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <Card className="actsix-panel p-5">
            <div className="flex flex-col items-center text-center">
              <PersonAvatar name={contact.name} avatarUrl={contact.photo_url} size="xl" shape="rounded" />
              <h2 className="mt-3 text-lg font-extrabold tracking-tight">{contact.name}</h2>
              {contact.category && (
                <span className="mt-1.5 inline-flex rounded-[var(--radius-control)] bg-brand-teal-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-teal-dark">
                  {contact.category}
                </span>
              )}
            </div>

            <div className="mt-4 space-y-2.5 border-t border-border/70 pt-4 text-sm">
              {contact.phone && (
                <a href={`tel:${contact.phone}`} className="flex items-center gap-2 font-semibold text-foreground hover:text-brand-teal">
                  <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{contact.phone}</span>
                </a>
              )}
              {contact.email && (
                <a href={`mailto:${contact.email}`} className="flex items-center gap-2 font-semibold text-foreground hover:text-brand-teal">
                  <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{contact.email}</span>
                </a>
              )}
              {contact.address && (
                <p className="flex items-center gap-2 font-semibold text-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{contact.address}</span>
                </p>
              )}
              {!contact.phone && !contact.email && !contact.address && (
                <p className="text-muted-foreground">No contact details yet.</p>
              )}
            </div>

            {contact.notes && (
              <div className="mt-4 border-t border-border/70 pt-4">
                <p className="label-eyebrow">Notes</p>
                <p className="mt-1.5 text-sm leading-5 text-muted-foreground">{contact.notes}</p>
              </div>
            )}

            {contact.last_used_at && (
              <div className="mt-4 border-t border-border/70 pt-4">
                <p className="label-eyebrow">Last Used</p>
                <p className="mt-1.5 text-sm font-bold">{formatDate(contact.last_used_at)}</p>
              </div>
            )}
          </Card>

          <Card className="actsix-panel p-5">
            <h3 className="text-base font-extrabold tracking-tight">Usage Log</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Track when this contact was used and what was done.
            </p>

            <form onSubmit={addLog} className="mt-4 space-y-2.5 rounded-[var(--radius-panel)] border border-border/70 bg-background/45 p-3">
              <div className="grid gap-2.5 sm:grid-cols-[160px_minmax(0,1fr)]">
                <div>
                  <label htmlFor="log-date" className="label-eyebrow">
                    Date
                  </label>
                  <Input
                    id="log-date"
                    type="date"
                    value={logDate}
                    onChange={(event) => setLogDate(event.target.value)}
                    className="mt-1.5 h-8 rounded-[var(--radius-control)] border-border/70 bg-background text-sm"
                    max={todayDateInput()}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="log-description" className="label-eyebrow">
                    What was done
                  </label>
                  <Textarea
                    id="log-description"
                    value={logDescription}
                    onChange={(event) => setLogDescription(event.target.value)}
                    placeholder="Replaced the water heater element..."
                    rows={1}
                    className="mt-1.5 min-h-8 rounded-[var(--radius-control)] border-border/70 bg-background text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" size="sm" className="actsix-btn-primary" disabled={savingLog || !logDate}>
                  <Plus className="h-3.5 w-3.5" />
                  {savingLog ? "Logging..." : "Log Usage"}
                </Button>
              </div>
            </form>

            <div className="mt-4 space-y-2">
              {logs.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">No usage logged yet.</p>
              )}

              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start justify-between gap-3 rounded-[var(--radius-control)] border border-border/70 bg-background/45 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold uppercase tracking-[0.1em] text-brand-teal">
                      {formatDate(log.used_at)}
                    </p>
                    {log.description && (
                      <p className="mt-1 text-sm leading-5 text-foreground">{log.description}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground/60 transition hover:bg-muted hover:text-destructive"
                    onClick={() => deleteLog(log)}
                    aria-label="Delete log entry"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <ServiceContactEditorModal
        contact={editingContact}
        saving={saving}
        uploadingPhoto={uploadingPhoto}
        categorySuggestions={categorySuggestion}
        onChange={setEditingContact}
        onClose={() => setEditingContact(null)}
        onSave={saveContact}
        onPhotoSelected={handlePhotoSelected}
      />

      {confirmDialog}
    </div>
  );
};

export default ServiceContactDetailPage;
