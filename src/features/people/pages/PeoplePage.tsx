import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Copy, Filter, Mail, Merge, Phone, Plus, Search, Send, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { useCurrentWorkspace } from "@/hooks/useCurrentWorkspace";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { formatPhoneForDisplay, getWhatsappHref, isMessageablePhone, normalizePhoneForStorage } from "@/lib/phone";

type Person = {
  id: string;
  user_id: string;
  workspace_id: string | null;
  auth_user_id: string | null;
  first_name: string;
  last_name: string | null;
  display_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  email: string | null;
  gender: string | null;
  membership_status: string | null;
  whatsapp_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}; 

type WorkspaceInvite = {
  workspace_id: string;
  workspace_name: string | null;
  join_code: string | null;
};

type CsvPersonRow = {
  first_name: string;
  last_name: string | null;
  display_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  email: string | null;
  gender: string | null;
  membership_status: string | null;
  whatsapp_enabled: boolean;
  notes: string | null;
};

const PeoplePage = () => {
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();
  const { workspace, canEditPeopleDirectory } = useCurrentWorkspace();

  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvPersonRow[]>([]);
  const [csvError, setCsvError] = useState("");
  const [importingCsv, setImportingCsv] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [welcomeRecipients, setWelcomeRecipients] = useState<CsvPersonRow[]>([]);
  const [workspaceInvite, setWorkspaceInvite] = useState<WorkspaceInvite | null>(null);
  const [peopleFilter, setPeopleFilter] = useState("all");
  const [customFilterOpen, setCustomFilterOpen] = useState(false);
  const [customFilters, setCustomFilters] = useState({
    canMessage: false,
    missingPhone: false,
    invalidPhone: false,
    missingEmail: false,
    male: false,
    female: false,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState("");
  const [membershipStatus, setMembershipStatus] = useState("Member");
  const [notes, setNotes] = useState("");

  const filteredPeople = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return people.filter((person) => {
      const matchesSearch =
        !query ||
        [
          person.display_name,
          person.phone_number,
          formatPhoneForDisplay(person.phone_number),
          person.email,
          person.gender,
          person.notes,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      if (peopleFilter === "members") {
        return (person.membership_status || "Member").toLowerCase() === "member";
      }

      if (peopleFilter === "custom") {
        if (customFilters.canMessage && !isMessageablePhone(person.phone_number)) return false;
        if (customFilters.missingPhone && person.phone_number) return false;
        if (
          customFilters.invalidPhone &&
          (!person.phone_number || isMessageablePhone(person.phone_number))
        ) {
          return false;
        }
        if (customFilters.missingEmail && person.email) return false;
        if (customFilters.male && person.gender?.toLowerCase() !== "male") return false;
        if (customFilters.female && person.gender?.toLowerCase() !== "female") return false;
      }

      return true;
    });
  }, [people, searchTerm, peopleFilter, customFilters]);

  const duplicateEmailGroups = useMemo(() => {
    const grouped = people.reduce<Record<string, Person[]>>((acc, person) => {
      const emailKey = person.email?.trim().toLowerCase();

      if (!emailKey) return acc;

      if (!acc[emailKey]) {
        acc[emailKey] = [];
      }

      acc[emailKey].push(person);
      return acc;
    }, {});

    return Object.entries(grouped)
      .filter(([, group]) => group.length > 1)
      .map(([email, group]) => ({ email, people: group }));
  }, [people]);

  const getProfileScore = (person: Person) => {
    let score = 0;

    if (person.phone_number) score += 10;
    if (person.email) score += 5;
    if (person.last_name) score += 4;
    if (person.notes && !person.notes.toLowerCase().includes("signed-in actsix user profile")) {
      score += 3;
    }
    if (person.auth_user_id) score += 2;
    if (person.display_name.split(/\s+/).length > 1) score += 2;

    return score;
  };

  const mergeDuplicateEmailProfiles = async () => {
    if (!user || !workspace?.id) return;

    if (duplicateEmailGroups.length === 0) {
      toast.success("No duplicate email profiles found.");
      return;
    }

    const confirmed = window.confirm(
      `Merge ${duplicateEmailGroups.length} duplicate email group(s)? ACTSIX will keep the most complete profile for each email and remove the duplicates.`
    );

    if (!confirmed) return;

    let deletedCount = 0;

    for (const group of duplicateEmailGroups) {
      const sortedProfiles = [...group.people].sort((a, b) => {
        const scoreDifference = getProfileScore(b) - getProfileScore(a);

        if (scoreDifference !== 0) return scoreDifference;

        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const primary = sortedProfiles[0];
      const duplicates = sortedProfiles.slice(1);
      const allGroupIds = sortedProfiles.map((person) => person.id);
      const duplicateIds = duplicates.map((person) => person.id);

      if (duplicateIds.length === 0) continue;

      const authUserId =
        sortedProfiles.find((person) => person.auth_user_id)?.auth_user_id || null;

      const phoneNumber =
        primary.phone_number ||
        sortedProfiles.find((person) => person.phone_number)?.phone_number ||
        null;

      const email =
        primary.email ||
        sortedProfiles.find((person) => person.email)?.email ||
        group.email;

      const gender =
        primary.gender ||
        sortedProfiles.find((person) => person.gender)?.gender ||
        null;

      const firstUsefulNotes = sortedProfiles
        .map((person) => person.notes)
        .filter(Boolean)
        .filter((note) => !note!.toLowerCase().includes("signed-in actsix user profile"));

      const signedInNote = sortedProfiles.some((person) =>
        person.notes?.toLowerCase().includes("signed-in actsix user profile")
      )
        ? "Signed-in ACTSIX user profile"
        : "";

      const notesToMerge = [...firstUsefulNotes, signedInNote]
        .filter(Boolean)
        .filter((note, index, notes) => notes.indexOf(note) === index);

      // Clear auth_user_id from the whole duplicate email group first.
      // This avoids the unique constraint while we move the auth link to the chosen primary.
      const { error: clearAuthError } = await (supabase as any)
        .from("people")
        .update({ auth_user_id: null, updated_at: new Date().toISOString() })
        .eq("workspace_id", workspace?.id ?? "00000000-0000-0000-0000-000000000000")
        .in("id", allGroupIds);

      if (clearAuthError) {
        toast.error(clearAuthError.message);
        return;
      }

      const { error: updatePrimaryError } = await (supabase as any)
        .from("people")
        .update({
          auth_user_id: authUserId,
          phone_number: phoneNumber,
          email,
          gender,
          whatsapp_enabled: sortedProfiles.some((person) => person.whatsapp_enabled),
          notes: notesToMerge.join("\n---\n") || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", primary.id)
        .eq("workspace_id", workspace?.id);

      if (updatePrimaryError) {
        toast.error(updatePrimaryError.message);
        return;
      }

      const { error: teamMemberError } = await (supabase as any)
        .from("service_team_members")
        .update({ person_id: primary.id })
        .eq("workspace_id", workspace?.id)
        .in("person_id", duplicateIds);

      if (teamMemberError) {
        toast.error(teamMemberError.message);
        return;
      }

      const { error: assignmentError } = await (supabase as any)
        .from("service_team_assignments")
        .update({ person_id: primary.id })
        .eq("workspace_id", workspace?.id)
        .in("person_id", duplicateIds);

      if (assignmentError) {
        toast.error(assignmentError.message);
        return;
      }

      const { error: deleteError } = await (supabase as any)
        .from("people")
        .delete()
        .eq("workspace_id", workspace?.id ?? "00000000-0000-0000-0000-000000000000")
        .in("id", duplicateIds);

      if (deleteError) {
        toast.error(deleteError.message);
        return;
      }

      deletedCount += duplicateIds.length;
    }

    toast.success(`Merged duplicate profiles. Removed ${deletedCount} duplicate record(s).`);
    await fetchPeople();
  };

  const fetchPeople = async () => {
    if (!user || !workspace?.id) return;

    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("people")
      .select("*")
      .eq("workspace_id", workspace?.id ?? "00000000-0000-0000-0000-000000000000")
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
  }, [user, workspace?.id]);

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

  const normalizeEmail = (value?: string | null) => {
    return value?.trim().toLowerCase() || null;
  };

  const fetchWorkspaceInvite = async () => {
    const { data, error } = await (supabase as any).rpc(
      "get_current_workspace_invite_details"
    );

    if (error) {
      console.error(error);
      return;
    }

    setWorkspaceInvite(data?.[0] || null);
  };

  const findExistingPersonByEmail = async (emailToCheck: string) => {
    if (!workspace?.id) return null;

    const { data, error } = await (supabase as any)
      .from("people")
      .select("id, display_name, email")
      .eq("workspace_id", workspace?.id ?? "00000000-0000-0000-0000-000000000000")
      .ilike("email", emailToCheck)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  };

  const getWelcomeMessage = (person: CsvPersonRow) => {
    const appUrl = window.location.origin;
    const firstName = person.first_name || person.display_name || "there";
    const workspaceName = workspaceInvite?.workspace_name || "our church workspace";
    const joinCodeLine = workspaceInvite?.join_code
      ? `Join code: ${workspaceInvite.join_code}`
      : "Join code: [ask the admin for the join code]";

    return `Hi ${firstName},

You've been added to ACTSIX for ${workspaceName}.

Please create your account here:
${appUrl}

After registering, choose the option to join an existing workspace.

${joinCodeLine}
Secret phrase: [add the current workspace secret phrase before sending]

Once your account is active, ACTSIX will connect you to your People profile automatically.`;
  };

  const copyWelcomeMessage = async (person: CsvPersonRow) => {
    const message = getWelcomeMessage(person);

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(message);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = message;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }

      toast.success("Welcome message copied.");
    } catch (error) {
      console.error(error);
      toast.error("Could not copy the welcome message.");
    }
  };

  const openWelcomeEmailDraft = (person: CsvPersonRow) => {
    if (!person.email) {
      toast.error("This person does not have an email address.");
      return;
    }

    const subject = encodeURIComponent("Welcome to ACTSIX");
    const body = encodeURIComponent(getWelcomeMessage(person));
    const mailtoUrl = `mailto:${person.email}?subject=${subject}&body=${body}`;

    window.open(mailtoUrl, "_self");
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
      const rawMembershipStatus = (row.membership_status || row.member_status || row.status || "").trim();
      const membershipStatus =
        rawMembershipStatus.toLowerCase() === "adherent" ? "Adherent" : "Member";
      const existingNotes = (row.notes || row.note || "").trim();

      parsedRows.push({
        first_name: firstName,
        last_name: lastName || null,
        display_name: displayName || firstName,
        avatar_url: null,
        phone_number: normalizePhoneForStorage(
          row.phone_number ||
            row.phone ||
            row.whatsapp_number ||
            row.primary_phone_number ||
            row.primary_phone ||
            ""
        ),
        email: normalizeEmail(
          row.email ||
            row.email_address ||
            row.primary_email ||
            row.primary_email_address ||
            ""
        ),
        gender: gender || null,
        membership_status: membershipStatus,
        whatsapp_enabled: false,
        notes: existingNotes || null,
      });
    });

    setCsvRows(parsedRows);
  };

  const importCsvPeople = async () => {
    if (!user || !workspace?.id || csvRows.length === 0) return;

    setImportingCsv(true);

    const emails = csvRows
      .map((row) => row.email?.trim().toLowerCase())
      .filter(Boolean) as string[];

    const { data: existingPeople, error: existingPeopleError } = await (supabase as any)
      .from("people")
      .select("*")
      .eq("workspace_id", workspace?.id ?? "00000000-0000-0000-0000-000000000000")
      .in("email", emails.length > 0 ? emails : ["__no_email_matches__"]);

    if (existingPeopleError) {
      toast.error(existingPeopleError.message);
      setImportingCsv(false);
      return;
    }

    const existingByEmail = new Map<string, Person>(
      (existingPeople || [])
        .filter((person: Person) => person.email)
        .map((person: Person) => [person.email!.trim().toLowerCase(), person])
    );

    const rowsToCreate: CsvPersonRow[] = [];
    const rowsToUpdate: Array<{ existing: Person; row: CsvPersonRow }> = [];

    csvRows.forEach((row) => {
      const emailKey = row.email?.trim().toLowerCase();

      if (emailKey && existingByEmail.has(emailKey)) {
        rowsToUpdate.push({
          existing: existingByEmail.get(emailKey)!,
          row,
        });
        return;
      }

      rowsToCreate.push(row);
    });

    for (const { existing, row } of rowsToUpdate) {
      const updatePayload = {
        first_name: existing.first_name || row.first_name,
        last_name: existing.last_name || row.last_name,
        display_name: existing.display_name || row.display_name,
        phone_number: existing.phone_number || normalizePhoneForStorage(row.phone_number),
        email: normalizeEmail(existing.email || row.email),
        gender: existing.gender || row.gender,
        membership_status: existing.membership_status || row.membership_status || "Member",
        whatsapp_enabled: Boolean(existing.whatsapp_enabled),
        notes:
          existing.notes && row.notes && !existing.notes.includes(row.notes)
            ? `${existing.notes}
---
${row.notes}`
            : existing.notes || row.notes,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await (supabase as any)
        .from("people")
        .update(updatePayload)
        .eq("id", existing.id)
        .eq("workspace_id", workspace?.id ?? "00000000-0000-0000-0000-000000000000");

      if (updateError) {
        toast.error(updateError.message);
        setImportingCsv(false);
        return;
      }
    }

    if (rowsToCreate.length > 0) {
      const { error: createError } = await (supabase as any).from("people").insert(
        rowsToCreate.map((row) => ({
          user_id: user.id,
          workspace_id: workspace.id,
          first_name: row.first_name,
          last_name: row.last_name,
          display_name: row.display_name,
          phone_number: normalizePhoneForStorage(row.phone_number),
          email: normalizeEmail(row.email),
          gender: row.gender,
          membership_status: row.membership_status || "Member",
          whatsapp_enabled: false,
          notes: row.notes,
        }))
      );

      if (createError) {
        toast.error(createError.message);
        setImportingCsv(false);
        return;
      }
    }

    toast.success(
      `CSV import complete: ${rowsToCreate.length} created, ${rowsToUpdate.length} existing profiles updated`
    );

    const welcomeRows = csvRows.filter((row) => row.email);
    if (welcomeRows.length > 0) {
      setWelcomeRecipients(welcomeRows);
    }

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
    setGender("");
    setMembershipStatus("Member");
    setNotes("");
  };

  const createPerson = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !workspace?.id) {
      toast.error("Workspace is still loading. Please try again.");
      return;
    }

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const displayName = [cleanFirstName, cleanLastName].filter(Boolean).join(" ");
    const cleanEmail = normalizeEmail(email);

    if (!cleanFirstName) {
      toast.error("First name is required.");
      return;
    }

    if (cleanEmail) {
      try {
        const existingPerson = await findExistingPersonByEmail(cleanEmail);

        if (existingPerson) {
          toast.error(
            `${existingPerson.display_name || "This person"} already exists with this email.`
          );
          return;
        }
      } catch (error: any) {
        toast.error(error.message || "Could not check for duplicate email.");
        return;
      }
    }

    const { data: createdPerson, error } = await (supabase as any)
      .from("people")
      .insert({
        user_id: user.id,
        workspace_id: workspace.id,
        first_name: cleanFirstName,
        last_name: cleanLastName || null,
        display_name: displayName,
        phone_number: normalizePhoneForStorage(phoneNumber),
        email: cleanEmail,
        gender: gender.trim() || null,
        membership_status: membershipStatus,
        whatsapp_enabled: false,
        notes: notes.trim() || null,
      })
      .select("first_name, last_name, display_name, avatar_url, phone_number, email, gender, membership_status, whatsapp_enabled, notes")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Person added");

    resetForm();
    setAddPersonOpen(false);

    if (createdPerson?.email) {
      setWelcomeRecipients([
        {
          first_name: createdPerson.first_name,
          last_name: createdPerson.last_name,
          display_name: createdPerson.display_name,
          avatar_url: createdPerson.avatar_url,
          phone_number: createdPerson.phone_number,
          email: createdPerson.email,
          gender: createdPerson.gender,
          membership_status: createdPerson.membership_status,
          whatsapp_enabled: createdPerson.whatsapp_enabled,
          notes: createdPerson.notes,
        },
      ]);

      toast.success("Invite prompt ready.");
    } else {
      toast.info("No email added, so no invite prompt was created.");
    }

    fetchPeople();
  };

  useEffect(() => {
    if (user && workspace?.id) {
      fetchWorkspaceInvite();
    }
  }, [user, workspace?.id]);

  return (
    <div className="w-full min-w-0 space-y-5 pb-10">
      <PageHeader
        eyebrow="People"
        title="People"
        subtitle="Alpha workspace users appear here automatically. Everyone can view the directory; only admins and editors can manage profiles."
        actions={
          <div data-tour="people-actions" className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
            {canEditPeopleDirectory && duplicateEmailGroups.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="actsix-btn-outline border-brand-teal/40 text-brand-teal hover:text-brand-teal"
                  onClick={mergeDuplicateEmailProfiles}
                >
                <Merge className="h-4 w-4" />
                Merge Duplicates
              </Button>
            )}

            {canEditPeopleDirectory && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="actsix-btn-outline"
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
                  size="sm"
                  className="actsix-btn-primary"
                  onClick={() => setAddPersonOpen(true)}
                >
                  <Plus className="h-4 w-4" />
                  Add Person
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="px-4 sm:px-6 xl:px-8 2xl:px-10">
        <div data-tour="people-search" className="actsix-toolbar flex min-w-0 flex-col gap-2 rounded-[1rem] lg:flex-row lg:items-center">
          <div className="actsix-interactive-row flex min-w-0 flex-1 items-center gap-2 bg-background px-3 py-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search people..."
            className="h-8 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
          />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
          {[
            ["all", "All"],
            ["members", "Members"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                peopleFilter === value
                  ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => {
                setPeopleFilter(value);
                setCustomFilterOpen(false);
              }}
            >
              {label}
            </button>
          ))}

          <div className="relative">
            <button
              type="button"
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
                peopleFilter === "custom"
                  ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
              onClick={() => {
                setCustomFilterOpen((open) => !open);
                setPeopleFilter("custom");
              }}
              aria-label="Custom filters"
              title="Custom filters"
            >
              <Filter className="h-3.5 w-3.5" />
            </button>

            {customFilterOpen && (
              <div className="actsix-overlay-surface absolute right-0 top-10 z-50 w-[min(18rem,calc(100vw-2rem))] p-4 sm:left-0 sm:right-auto">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-extrabold tracking-tight">
                      Custom Filter
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Choose what to show in the People list.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setCustomFilterOpen(false)}
                    aria-label="Close custom filters"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    ["canMessage", "Can message"],
                    ["missingPhone", "Missing phone"],
                    ["invalidPhone", "Invalid phone"],
                    ["missingEmail", "Missing email"],
                    ["male", "Male"],
                    ["female", "Female"],
                  ].map(([key, label]) => (
                    <label
                      key={key}
                      className="actsix-interactive-row flex items-center gap-2 bg-background/70 px-3 py-2 text-sm font-bold"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(customFilters[key as keyof typeof customFilters])}
                        onChange={(event) => {
                          setCustomFilters((current) => ({
                            ...current,
                            [key]: event.target.checked,
                          }));
                          setPeopleFilter("custom");
                        }}
                        className="h-4 w-4 accent-brand-teal"
                      />
                      {label}
                    </label>
                  ))}
                </div>

                <div className="mt-4 flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="actsix-btn-outline"
                    onClick={() => {
                      setCustomFilters({
                        canMessage: false,
                        missingPhone: false,
                        invalidPhone: false,
                        missingEmail: false,
                        male: false,
                        female: false,
                      });
                      setPeopleFilter("all");
                      setCustomFilterOpen(false);
                    }}
                  >
                    Clear
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    className="actsix-btn-primary"
                    onClick={() => {
                      setPeopleFilter("custom");
                      setCustomFilterOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>

        {loading && (
          <Card className="actsix-panel mt-5 rounded-[1rem] p-6 sm:mt-6">
            <div className="actsix-loading-state" role="status">Loading people...</div>
          </Card>
        )}

        {!loading && filteredPeople.length === 0 && (
          <Card className="actsix-panel mt-5 rounded-[1rem] p-8 sm:mt-6 sm:p-10">
            <div className="actsix-empty-state flex flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold tracking-tight">
              No people found
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              People who join this workspace will appear here automatically.
            </p>
          </div>
          </Card>
        )}

        {!loading && filteredPeople.length > 0 && (
          <Card data-tour="people-list" className="actsix-panel mt-5 overflow-hidden rounded-[1rem] sm:mt-6">
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(180px,0.8fr)_minmax(240px,1fr)_auto] gap-3 border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground md:grid">
            <div>Person</div>
            <div>Phone</div>
            <div>Email</div>
            <div>Message</div>
          </div>

          <div className="divide-y divide-border">
            {filteredPeople.map((person) => (
              <Link
                key={person.id}
                to={`/people/${person.id}`}
                className="flex min-w-0 flex-col gap-3 px-3.5 py-3 transition hover:bg-brand-teal/5 md:grid md:grid-cols-[minmax(0,1.3fr)_minmax(180px,0.8fr)_minmax(240px,1fr)_auto] md:items-center md:gap-3 md:px-3 md:py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <PersonAvatar
                    name={person.display_name}
                    avatarUrl={person.avatar_url}
                    size="sm"
                    shape="rounded"
                  />

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="truncate text-sm font-extrabold tracking-tight text-foreground">
                        {person.display_name}
                      </div>

                      {person.auth_user_id === user?.id && (
                        <span className="shrink-0 rounded-full border border-brand-teal bg-brand-teal/10 px-2 py-0.5 text-[10px] font-bold text-brand-teal">
                          You
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{person.membership_status || "Member"}</span>
                      {person.gender && (
                        <>
                          <span>·</span>
                          <span>{person.gender}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="min-w-0 text-[13px] text-muted-foreground">
                  {person.phone_number ? (
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{formatPhoneForDisplay(person.phone_number)}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/55">—</span>
                  )}
                </div>

                <div className="min-w-0 text-[13px] text-muted-foreground">
                  {person.email ? (
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <Mail className="h-3 w-3 shrink-0" />
                      <span className="truncate">{person.email}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground/55">—</span>
                  )}
                </div>

                <div className="flex justify-start md:justify-end">
                  {isMessageablePhone(person.phone_number) ? (
                    <button
                      type="button"
                      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-brand-teal bg-brand-teal/10 px-3 text-xs font-extrabold text-brand-teal transition hover:bg-brand-teal/15 md:h-8 md:w-8 md:rounded-full md:px-0"
                      title="Message on WhatsApp"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        window.open(getWhatsappHref(person.phone_number), "_blank", "noreferrer");
                      }}
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span className="md:hidden">Message</span>
                    </button>
                  ) : (
                    <span
                      className="inline-flex h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-extrabold text-muted-foreground/50 md:h-8 md:w-8 md:rounded-full md:px-0"
                      title={person.phone_number ? "Invalid phone format. Use +27..." : "No phone number"}
                    >
                      <Send className="h-3.5 w-3.5" />
                      <span className="md:hidden">No message</span>
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
          </Card>
        )}
      </div>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCsvRows([]);
            setCsvError("");
          }
          setImportOpen(open);
        }}
      >
        <DialogContent className="max-h-[92svh] max-w-3xl overflow-y-auto rounded-b-none p-4 sm:rounded-[var(--radius-overlay)] sm:p-6">
          <DialogHeader>
            <p className="label-eyebrow">People</p>
            <DialogTitle className="text-xl">Import People from CSV</DialogTitle>
            <DialogDescription>
              Upload a CSV file to add multiple People profiles at once.
            </DialogDescription>
          </DialogHeader>

            <div className="mt-1 rounded-[var(--radius-panel)] border border-border/70 bg-background/70 p-4">
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
                  You can also use <span className="font-mono">name,phone,email,notes</span>. Gender imports into the Gender field.
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
                <div className="hidden grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_120px] gap-3 border-b border-border bg-background px-4 py-3 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground md:grid">
                  <div>Name</div>
                  <div>Phone</div>
                  <div>Email</div>
                  <div>Message</div>
                </div>

                <div className="max-h-72 divide-y divide-border overflow-auto bg-card">
                  {csvRows.map((row, index) => (
                    <div
                      key={`${row.display_name}-${index}`}
                      className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)_120px] md:gap-3"
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
                        {formatPhoneForDisplay(row.phone_number) || "—"}
                      </div>

                      <div className="truncate text-muted-foreground">
                        {row.email || "—"}
                      </div>

                      <div>
                        {isMessageablePhone(row.phone_number) ? (
                          <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-2 py-1 text-xs font-bold text-brand-teal">
                            Can message
                          </span>
                        ) : (
                          <span className="rounded-full border border-border bg-background px-2 py-1 text-xs font-bold text-muted-foreground">
                            Check phone
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter className="mt-5 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="actsix-btn-outline"
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
                className="actsix-btn-primary"
                onClick={importCsvPeople}
                disabled={csvRows.length === 0 || importingCsv}
              >
                <Upload className="h-4 w-4" />
                {importingCsv ? "Importing..." : `Import ${csvRows.length || ""} People`}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={welcomeRecipients.length > 0} onOpenChange={(open) => !open && setWelcomeRecipients([])}>
        <DialogContent className="max-h-[92svh] max-w-3xl overflow-y-auto rounded-b-none p-4 sm:rounded-[var(--radius-overlay)] sm:p-6">
            <DialogHeader>
              <p className="label-eyebrow">People</p>
              <DialogTitle className="text-xl">Invite people to activate their ACTSIX account</DialogTitle>
              <DialogDescription>
                Send these people a welcome message so they can register, join the workspace, and connect to their People profile automatically.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-1 rounded-[var(--radius-panel)] border border-border/70 bg-background/70 p-4 text-sm text-muted-foreground">
              <p>
                The welcome message includes the ACTSIX link and join code. Add the current secret phrase from{" "}
                <span className="font-semibold text-foreground">Settings → Workspace Settings</span> before sending.
              </p>
            </div>

            <div className="mt-5 max-h-80 space-y-3 overflow-auto">
              {welcomeRecipients.map((recipient, index) => (
                <div key={`${recipient.email}-${index}`} className="actsix-interactive-row flex flex-col gap-3 bg-background p-4 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <p className="font-extrabold tracking-tight">
                      {recipient.display_name}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">
                      {recipient.email}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 md:flex md:shrink-0">
                    <Button
                      type="button"
                      variant="outline"
                      className="actsix-btn-outline"
                      onClick={() => copyWelcomeMessage(recipient)}
                    >
                      <Copy className="h-4 w-4" />
                      Copy
                    </Button>

                    <Button
                      type="button"
                      className="actsix-btn-primary"
                      onClick={() => openWelcomeEmailDraft(recipient)}
                    >
                      <Send className="h-4 w-4" />
                      Email
                    </Button>
                  </div>
                </div>
              ))}
            </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addPersonOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setAddPersonOpen(open);
        }}
      >
        <DialogContent className="max-h-[92svh] max-w-2xl overflow-y-auto rounded-b-none p-4 sm:rounded-[var(--radius-overlay)] sm:p-6">
            <DialogHeader>
              <p className="label-eyebrow">People</p>
              <DialogTitle className="text-xl">Add Person</DialogTitle>
              <DialogDescription>
                Create one profile that can later connect to teams, roles, services, and communication.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={createPerson} className="mt-2 space-y-4">
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
                    placeholder="073 775 4927"
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

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">Gender</label>
                  <select
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                    className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    <option value="">Not specified</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow">Membership</label>
                  <select
                    value={membershipStatus}
                    onChange={(event) => setMembershipStatus(event.target.value)}
                    className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    <option value="Member">Member</option>
                    <option value="Adherent">Adherent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="label-eyebrow">Notes</label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Care notes, serving preferences, availability, family context..."
                  className="mt-2 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                />
              </div>

              <DialogFooter className="grid grid-cols-2 gap-2 pt-2 sm:flex sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="actsix-btn-outline"
                  onClick={() => {
                    resetForm();
                    setAddPersonOpen(false);
                  }}
                >
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary">
                  <Plus className="h-4 w-4" />
                  Add Person
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PeoplePage;
