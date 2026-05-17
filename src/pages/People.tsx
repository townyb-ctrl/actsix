import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, MessageCircle, Phone, Plus, Search, Users } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type Person = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  display_name: string;
  phone_number: string | null;
  email: string | null;
  whatsapp_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const People = () => {
  const { user } = useAuth();

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [notes, setNotes] = useState("");

  const filteredPeople = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) return people;

    return people.filter((person) => {
      return [
        person.display_name,
        person.phone_number,
        person.email,
        person.notes,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [people, searchTerm]);

  const fetchPeople = async () => {
    if (!user) return;

    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("people")
      .select("*")
      .eq("user_id", user.id)
      .order("display_name", { ascending: true });

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setPeople(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchPeople();
  }, [user]);

  const resetForm = () => {
    setFirstName("");
    setLastName("");
    setPhoneNumber("");
    setEmail("");
    setWhatsappEnabled(false);
    setNotes("");
  };

  const createPerson = async (event: FormEvent) => {
    event.preventDefault();

    if (!user) return;

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const displayName = [cleanFirstName, cleanLastName].filter(Boolean).join(" ");

    if (!cleanFirstName) {
      toast.error("First name is required.");
      return;
    }

    const { error } = await (supabase as any).from("people").insert({
      user_id: user.id,
      first_name: cleanFirstName,
      last_name: cleanLastName || null,
      display_name: displayName,
      phone_number: phoneNumber.trim() || null,
      email: email.trim() || null,
      whatsapp_enabled: whatsappEnabled,
      notes: notes.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Person added");
    resetForm();
    setAddPersonOpen(false);
    fetchPeople();
  };

  return (
    <div className="px-8 pt-8 pb-12 max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="label-eyebrow">ACTSIX: People</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            People
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
            Store individual profiles once, then connect people to teams, roles, services, and future care workflows.
          </p>
        </div>

        <Button
          type="button"
          className="actsix-btn-primary rounded-xl"
          onClick={() => setAddPersonOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add Person
        </Button>
      </div>

      <Card className="border-border/70 bg-card shadow-card p-4">
        <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search people..."
            className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div>
      </Card>

      {loading && (
        <Card className="border-border/70 bg-card shadow-card p-6">
          <p className="text-sm text-muted-foreground">Loading people...</p>
        </Card>
      )}

      {!loading && filteredPeople.length === 0 && (
        <Card className="border-border/70 bg-card shadow-card p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold tracking-tight">
              No people found
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Add your first person profile so ACTSIX can connect individuals across teams and services.
            </p>
          </div>
        </Card>
      )}

      {!loading && filteredPeople.length > 0 && (
        <Card className="overflow-hidden border-border/70 bg-card shadow-card">
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)_minmax(220px,1fr)_auto] gap-4 border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            <div>Person</div>
            <div>Phone</div>
            <div>Email</div>
            <div>Status</div>
          </div>

          <div className="divide-y divide-border">
            {filteredPeople.map((person) => (
              <Link
                key={person.id}
                to={`/people/${person.id}`}
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(180px,0.8fr)_minmax(220px,1fr)_auto] items-center gap-4 px-4 py-3 transition hover:bg-brand-teal/5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                    <Users className="h-4 w-4" />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-extrabold tracking-tight text-foreground">
                      {person.display_name}
                    </div>
                    {person.notes && (
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {person.notes}
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-w-0 text-sm text-muted-foreground">
                  {person.phone_number ? (
                    <span className="inline-flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" />
                      {person.phone_number}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/55">—</span>
                  )}
                </div>

                <div className="min-w-0 text-sm text-muted-foreground">
                  {person.email ? (
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{person.email}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/55">—</span>
                  )}
                </div>

                <div className="flex justify-end">
                  {person.whatsapp_enabled ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-brand-teal bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal">
                      <MessageCircle className="h-3 w-3" />
                      WhatsApp ready
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold text-muted-foreground">
                      Profile
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {addPersonOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">ACTSIX: People</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Add Person
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create one profile that can later connect to teams, roles, services, and communication.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  resetForm();
                  setAddPersonOpen(false);
                }}
              >
                Close
              </Button>
            </div>

            <form onSubmit={createPerson} className="mt-6 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">First Name</label>
                  <Input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    placeholder="Brandon"
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Last Name</label>
                  <Input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    placeholder="Townsend"
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">Phone / WhatsApp Number</label>
                  <Input
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+27..."
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Email</label>
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/70 p-4 text-sm font-bold">
                <input
                  type="checkbox"
                  checked={whatsappEnabled}
                  onChange={(event) => setWhatsappEnabled(event.target.checked)}
                  className="h-4 w-4 accent-brand-teal"
                />
                WhatsApp enabled
              </label>

              <div>
                <label className="label-eyebrow">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Care notes, serving preferences, availability, family context..."
                  className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    resetForm();
                    setAddPersonOpen(false);
                  }}
                >
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary rounded-xl">
                  <Plus className="h-4 w-4" />
                  Add Person
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default People;
