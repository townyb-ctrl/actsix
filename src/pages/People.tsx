import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Mail, MessageCircle, Phone, Plus, Search, Upload, Users } from "lucide-react";
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

type CsvPersonRow = {
  first_name: string;
  last_name: string | null;
  display_name: string;
  phone_number: string | null;
  email: string | null;
  whatsapp_enabled: boolean;
  notes: string | null;
};

const People = () => {
  const { user } = useAuth();

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvPersonRow[]>([]);
  const [csvError, setCsvError] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);
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

  const getMembershipSummaryForPerson = (personId: string) => {
    const personMemberships = memberships.filter(
      (membership) => membership.person_id === personId
    );

    const grouped = personMemberships.reduce<Record<string, string[]>>((acc, membership) => {
      const teamName = membership.service_teams?.name || "Service Team";
      const roleName = membership.role_name?.trim();

      if (!acc[teamName]) {
        acc[teamName] = [];
      }

      if (roleName && !acc[teamName].includes(roleName)) {
        acc[teamName].push(roleName);
      }

      return acc;
    }, {});

    return Object.entries(grouped).map(([teamName, roles]) => ({
      teamName,
      roles,
    }));
  };

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

  const parseCsvLine = (line: string) => {
    const values: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"' && insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === "," && !insideQuotes) {
        values.push(current.trim());
        current = "";
        continue;
      }

      current += char;
    }

    values.push(current.trim());
    return values;
  };

  const normalizeHeader = (value: string) => {
    return value.trim().toLowerCase().replace(/\s+/g, "_");
  };

  const getBooleanValue = (value?: string) => {
    const normalized = (value || "").trim().toLowerCase();
    return ["true", "yes", "y", "1", "whatsapp", "enabled"].includes(normalized);
  };

  const splitName = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return { firstName: "", lastName: "" };
    }

    if (parts.length === 1) {
      return { firstName: parts[0], lastName: "" };
    }

    return {
      firstName: parts[0],
      lastName: parts.slice(1).join(" "),
    };
  };

  const handleCsvFile = async (file?: File | null) => {
    setCsvError("");
    setCsvRows([]);

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setCsvError("Please choose a CSV file.");
      return;
    }

    const content = await file.text();
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length < 2) {
      setCsvError("CSV must include a header row and at least one person.");
      return;
    }

    const headers = parseCsvLine(lines[0]).map(normalizeHeader);
    const rows = lines.slice(1);

    const parsedRows: CsvPersonRow[] = [];

    rows.forEach((line, index) => {
      const values = parseCsvLine(line);
      const row = headers.reduce<Record<string, string>>((acc, header, valueIndex) => {
        acc[header] = values[valueIndex] || "";
        return acc;
      }, {});

      const rawDisplayName = row.display_name || row.name || "";
      const split = splitName(rawDisplayName);

      const firstName = (row.first_name || row.firstname || split.firstName || "").trim();
      const lastName = (row.last_name || row.lastname || split.lastName || "").trim();
      const displayName = (row.display_name || row.name || [firstName, lastName].filter(Boolean).join(" ")).trim();

      if (!firstName) {
        throw new Error(`Row ${index + 2}: first_name or name is required.`);
      }

      const gender = (row.gender || "").trim();
      const existingNotes = (row.notes || row.note || "").trim();

      parsedRows.push({
        first_name: firstName,
        last_name: lastName || null,
        display_name: displayName || firstName,
        phone_number:
          (
            row.phone_number ||
            row.phone ||
            row.whatsapp_number ||
            row.primary_phone_number ||
            row.primary_phone ||
            ""
          ).trim() || null,
        email:
          (
            row.email ||
            row.email_address ||
            row.primary_email ||
            row.primary_email_address ||
            ""
          ).trim() || null,
        whatsapp_enabled: getBooleanValue(row.whatsapp_enabled || row.whatsapp || row.whatsapp_ready),
        notes:
          [existingNotes, gender ? `Gender: ${gender}` : ""]
            .filter(Boolean)
            .join(" | ") || null,
      });
    });

    setCsvRows(parsedRows);
  };

  const importCsvPeople = async () => {
    if (!user || csvRows.length === 0) return;

    setImportingCsv(true);

    const { error } = await (supabase as any).from("people").insert(
      csvRows.map((row) => ({
        user_id: user.id,
        first_name: row.first_name,
        last_name: row.last_name,
        display_name: row.display_name,
        phone_number: row.phone_number,
        email: row.email,
        whatsapp_enabled: row.whatsapp_enabled,
        notes: row.notes,
      }))
    );

    if (error) {
      toast.error(error.message);
      setImportingCsv(false);
      return;
    }

    toast.success(`${csvRows.length} people imported`);
    setCsvRows([]);
    setCsvError("");
    setImportOpen(false);
    setImportingCsv(false);
    fetchPeople();
  };

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

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setCsvRows([]);
              setCsvError("");
              setImportOpen(true);
            }}
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>

          <Button
            type="button"
            className="actsix-btn-primary rounded-xl"
            onClick={() => setAddPersonOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Person
          </Button>
        </div>
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
          <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(180px,0.8fr)_minmax(240px,1fr)_auto] gap-4 border-b border-border px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
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
                className="grid grid-cols-[minmax(0,1.3fr)_minmax(180px,0.8fr)_minmax(240px,1fr)_auto] items-center gap-4 px-4 py-3 transition hover:bg-brand-teal/5"
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

      {importOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-3xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">ACTSIX: People</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Import People from CSV
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upload a CSV file to add multiple People profiles at once.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setCsvRows([]);
                  setCsvError("");
                  setImportOpen(false);
                }}
              >
                Close
              </Button>
            </div>

            <div className="mt-5 rounded-2xl border border-border/70 bg-background/70 p-4">
              <label className="label-eyebrow">CSV File</label>
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => {
                  handleCsvFile(event.target.files?.[0]).catch((error) => {
                    setCsvRows([]);
                    setCsvError(error instanceof Error ? error.message : "Could not read CSV file.");
                  });
                }}
                className="mt-2 border-border/70 bg-card"
              />

              <div className="mt-3 rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                <p className="font-bold text-foreground">Supported headers:</p>
                <p className="mt-1 font-mono">
                  First Name,Last Name,Primary Phone Number,Primary Email,Gender
                </p>
                <p className="mt-2">
                  You can also use <span className="font-mono">name,phone,email,whatsapp,notes</span>. Gender will be stored in notes for now.
                </p>
              </div>

              {csvError && (
                <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm font-bold text-destructive">
                  {csvError}
                </div>
              )}
            </div>

            {csvRows.length > 0 && (
              <div className="mt-5 overflow-hidden rounded-2xl border border-border/70">
                <div className="grid grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_120px] gap-3 border-b border-border bg-background px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  <div>Name</div>
                  <div>Phone</div>
                  <div>Email</div>
                  <div>Status</div>
                </div>

                <div className="max-h-72 divide-y divide-border overflow-auto bg-card">
                  {csvRows.map((row, index) => (
                    <div
                      key={`${row.display_name}-${index}`}
                      className="grid grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_120px] gap-3 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-extrabold tracking-tight">
                          {row.display_name}
                        </p>
                        {row.notes && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {row.notes}
                          </p>
                        )}
                      </div>

                      <div className="truncate text-muted-foreground">
                        {row.phone_number || "—"}
                      </div>

                      <div className="truncate text-muted-foreground">
                        {row.email || "—"}
                      </div>

                      <div>
                        {row.whatsapp_enabled ? (
                          <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-2 py-1 text-xs font-bold text-brand-teal">
                            WhatsApp
                          </span>
                        ) : (
                          <span className="rounded-full border border-border bg-background px-2 py-1 text-xs font-bold text-muted-foreground">
                            Profile
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setCsvRows([]);
                  setCsvError("");
                  setImportOpen(false);
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="actsix-btn-primary rounded-xl"
                onClick={importCsvPeople}
                disabled={csvRows.length === 0 || importingCsv}
              >
                <Upload className="h-4 w-4" />
                {importingCsv ? "Importing..." : `Import ${csvRows.length || ""} People`}
              </Button>
            </div>
          </Card>
        </div>
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
