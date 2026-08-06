import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MapPin, Phone, Plus, Search, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { useConfirm } from "@/hooks/useConfirm";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import ServiceContactEditorModal, {
  type ServiceContactDraft,
} from "@/features/people/components/ServiceContactEditorModal";
import { uploadServiceContactPhoto } from "@/features/people/lib/uploadServiceContactPhoto";

export type ServiceContact = {
  id: string;
  workspace_id: string;
  user_id: string;
  name: string;
  category: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  photo_url: string | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

const EMPTY_DRAFT: ServiceContactDraft = {
  name: "",
  category: "",
  phone: "",
  email: "",
  address: "",
  notes: "",
  photo_url: null,
};

const ServiceContactsPage = () => {
  const { user } = useAuth();
  const { workspace } = useCurrentWorkspace();
  const { confirmAction, confirmDialog } = useConfirm();

  const [contacts, setContacts] = useState<ServiceContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [editingContact, setEditingContact] = useState<ServiceContactDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const load = async () => {
    if (!workspace) return;

    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("service_contacts")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("name", { ascending: true });

    if (error) {
      toast.error(friendlyErrorMessage(error));
      setLoading(false);
      return;
    }

    setContacts(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [workspace?.id]);

  const categories = useMemo(() => {
    const seen = new Set<string>();
    contacts.forEach((contact) => {
      const label = contact.category.trim();
      if (label) seen.add(label);
    });
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return contacts.filter((contact) => {
      const matchesCategory = activeCategory === "all" || contact.category === activeCategory;
      const matchesSearch =
        !query ||
        [contact.name, contact.category, contact.phone, contact.email, contact.address]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(query));

      return matchesCategory && matchesSearch;
    });
  }, [contacts, search, activeCategory]);

  const openNewContact = () => setEditingContact({ ...EMPTY_DRAFT });

  const openEditContact = (contact: ServiceContact) => {
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
    if (!editingContact || !workspace || !user || !editingContact.name.trim()) return;

    setSaving(true);

    const payload = {
      workspace_id: workspace.id,
      user_id: user.id,
      name: editingContact.name.trim(),
      category: editingContact.category.trim(),
      phone: editingContact.phone.trim(),
      email: editingContact.email.trim(),
      address: editingContact.address.trim(),
      notes: editingContact.notes.trim(),
      photo_url: editingContact.photo_url,
      updated_at: new Date().toISOString(),
    };

    const { error } = editingContact.id
      ? await (supabase as any).from("service_contacts").update(payload).eq("id", editingContact.id)
      : await (supabase as any).from("service_contacts").insert(payload);

    setSaving(false);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return;
    }

    toast.success(editingContact.id ? "Contact updated" : "Contact added");
    setEditingContact(null);
    load();
  };

  const deleteContact = async (contact: ServiceContact) => {
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
    load();
  };

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Service Contacts"
        subtitle="Frequently-used outside contacts your workspace calls on - electricians, plumbers, police, ambulance, social workers, and more."
        actions={
          <Button type="button" size="sm" className="actsix-btn-primary min-h-10 shrink-0" onClick={openNewContact}>
            <Plus className="h-4 w-4" />
            Add Contact
          </Button>
        }
      />

      <div className="w-full space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="actsix-search-field w-full sm:w-64">
            <Search className="actsix-search-icon" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search contacts..."
              aria-label="Search service contacts"
              className="actsix-search-input"
            />
          </div>

          {categories.length > 0 && (
            <div className="actsix-filter-pills">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`actsix-filter-pill ${activeCategory === "all" ? "actsix-filter-pill-active" : "actsix-filter-pill-idle"}`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setActiveCategory(category)}
                  className={`actsix-filter-pill ${activeCategory === category ? "actsix-filter-pill-active" : "actsix-filter-pill-idle"}`}
                >
                  {category}
                </button>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <Card className="actsix-panel p-5">
            <div className="actsix-loading-state" role="status">
              Loading contacts...
            </div>
          </Card>
        )}

        {!loading && filteredContacts.length === 0 && (
          <Card className="actsix-panel p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold tracking-tight">
              {contacts.length === 0 ? "No service contacts yet" : "No contacts match"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {contacts.length === 0
                ? "Add the electrician, plumber, or emergency contacts your workspace calls on."
                : "Try a different search or category."}
            </p>
          </Card>
        )}

        {!loading && filteredContacts.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {filteredContacts.map((contact) => (
              <Card
                key={contact.id}
                className="group actsix-panel-soft flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-teal/40 hover:shadow-md"
              >
                <Link to={`/people/contacts/${contact.id}`} className="flex flex-1 items-start gap-3 p-3">
                  <PersonAvatar name={contact.name} avatarUrl={contact.photo_url} size="lg" shape="rounded" />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="truncate text-base font-extrabold tracking-tight text-foreground transition group-hover:text-brand-teal">
                        {contact.name}
                      </h2>
                    </div>

                    {contact.category && (
                      <span className="mt-1 inline-flex rounded-[var(--radius-control)] bg-brand-teal-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-teal-dark">
                        {contact.category}
                      </span>
                    )}

                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {contact.phone && (
                        <p className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 shrink-0" />
                          <span className="truncate">{contact.phone}</span>
                        </p>
                      )}
                      {contact.email && (
                        <p className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{contact.email}</span>
                        </p>
                      )}
                      {contact.address && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{contact.address}</span>
                        </p>
                      )}
                    </div>

                    {contact.last_used_at && (
                      <p className="mt-2 text-[11px] font-semibold text-muted-foreground">
                        Last used {new Date(contact.last_used_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    )}
                  </div>
                </Link>

                <div className="flex items-center justify-between border-t border-border/70 px-3 py-1.5">
                  <button
                    type="button"
                    className="text-xs font-semibold text-muted-foreground hover:text-brand-teal"
                    onClick={() => openEditContact(contact)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground/60 transition hover:bg-muted hover:text-destructive"
                    onClick={() => deleteContact(contact)}
                    aria-label={`Delete ${contact.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ServiceContactEditorModal
        contact={editingContact}
        saving={saving}
        uploadingPhoto={uploadingPhoto}
        categorySuggestions={categories}
        onChange={setEditingContact}
        onClose={() => setEditingContact(null)}
        onSave={saveContact}
        onPhotoSelected={handlePhotoSelected}
      />

      {confirmDialog}
    </div>
  );
};

export default ServiceContactsPage;
