import { useEffect, useState, type FormEvent } from "react";
import { CalendarDays, Clock3, Mail, MapPin, MessageCircle, Phone, Save, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Link, useParams } from "react-router-dom";

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

type TeamMembership = {
  id: string;
  team_id: string;
  role_name: string | null;
  notes: string | null;
  service_teams?: {
    name: string;
  } | null;
};

type ServiceAssignment = {
  id: string;
  service_id: string;
  team_id: string | null;
  role_name: string;
  notes: string | null;
  created_at: string;
};

type ServiceInstance = {
  id: string;
  title: string | null;
  service_date: string;
  start_time: string | null;
  location: string | null;
};

const formatDate = (value?: string | null) => {
  if (!value) return "No date";

  return new Date(value + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const PersonDetail = () => {
  const { personId } = useParams();
  const { user } = useAuth();

  const [person, setPerson] = useState<Person | null>(null);
  const [memberships, setMemberships] = useState<TeamMembership[]>([]);
  const [serviceAssignments, setServiceAssignments] = useState<ServiceAssignment[]>([]);
  const [assignmentServices, setAssignmentServices] = useState<ServiceInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [notes, setNotes] = useState("");

  const fetchPerson = async () => {
    if (!user || !personId) return;

    setLoading(true);

    const { data, error } = await (supabase as any)
      .from("people")
      .select("*")
      .eq("id", personId)
      .eq("user_id", user.id)
      .single();

    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }

    setPerson(data);
    setFirstName(data.first_name || "");
    setLastName(data.last_name || "");
    setPhoneNumber(data.phone_number || "");
    setEmail(data.email || "");
    setWhatsappEnabled(Boolean(data.whatsapp_enabled));
    setNotes(data.notes || "");

    const { data: membershipData, error: membershipError } = await (supabase as any)
      .from("service_team_members")
      .select("id, team_id, role_name, notes, service_teams(name)")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .order("role_name", { ascending: true });

    if (membershipError) {
      toast.error(membershipError.message);
    }

    setMemberships(membershipData || []);

    const { data: assignmentData, error: assignmentError } = await (supabase as any)
      .from("service_team_assignments")
      .select("id, service_id, team_id, role_name, notes, created_at")
      .eq("user_id", user.id)
      .eq("person_id", personId)
      .order("created_at", { ascending: false });

    if (assignmentError) {
      toast.error(assignmentError.message);
    }

    const nextAssignments = assignmentData || [];
    setServiceAssignments(nextAssignments);

    const serviceIds = Array.from(
      new Set(nextAssignments.map((assignment: ServiceAssignment) => assignment.service_id))
    );

    if (serviceIds.length > 0) {
      const { data: serviceData, error: servicesError } = await (supabase as any)
        .from("service_instances")
        .select("id, title, service_date, start_time, location")
        .eq("user_id", user.id)
        .in("id", serviceIds)
        .order("service_date", { ascending: false });

      if (servicesError) {
        toast.error(servicesError.message);
      }

      setAssignmentServices(serviceData || []);
    } else {
      setAssignmentServices([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchPerson();
  }, [user, personId]);

  const cancelEdit = () => {
    if (!person) return;

    setFirstName(person.first_name || "");
    setLastName(person.last_name || "");
    setPhoneNumber(person.phone_number || "");
    setEmail(person.email || "");
    setWhatsappEnabled(Boolean(person.whatsapp_enabled));
    setNotes(person.notes || "");
    setEditing(false);
  };

  const updatePerson = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !person) return;

    const cleanFirstName = firstName.trim();
    const cleanLastName = lastName.trim();
    const displayName = [cleanFirstName, cleanLastName].filter(Boolean).join(" ");

    if (!cleanFirstName) {
      toast.error("First name is required.");
      return;
    }

    const { error } = await (supabase as any)
      .from("people")
      .update({
        first_name: cleanFirstName,
        last_name: cleanLastName || null,
        display_name: displayName,
        phone_number: phoneNumber.trim() || null,
        email: email.trim() || null,
        whatsapp_enabled: whatsappEnabled,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", person.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Person updated");
    setEditing(false);
    fetchPerson();
  };


  const todayDateKey = new Date().toISOString().slice(0, 10);

  const getServiceForAssignment = (serviceId: string) => {
    return assignmentServices.find((serviceItem) => serviceItem.id === serviceId) || null;
  };

  const upcomingServiceAssignments = serviceAssignments
    .filter((assignment) => {
      const linkedService = getServiceForAssignment(assignment.service_id);
      return linkedService?.service_date && linkedService.service_date >= todayDateKey;
    })
    .sort((a, b) => {
      const aService = getServiceForAssignment(a.service_id);
      const bService = getServiceForAssignment(b.service_id);
      return (aService?.service_date || "").localeCompare(bService?.service_date || "");
    });

  const pastServiceAssignments = serviceAssignments
    .filter((assignment) => {
      const linkedService = getServiceForAssignment(assignment.service_id);
      return !linkedService?.service_date || linkedService.service_date < todayDateKey;
    })
    .sort((a, b) => {
      const aService = getServiceForAssignment(a.service_id);
      const bService = getServiceForAssignment(b.service_id);
      return (bService?.service_date || "").localeCompare(aService?.service_date || "");
    });

  if (loading) {
    return (
      <div className="px-8 py-12">
        <p className="text-sm text-muted-foreground">Loading person...</p>
      </div>
    );
  }

  if (!person) {
    return (
      <div className="px-8 py-12">
        <Card className="border-border/70 bg-card p-6 shadow-card">
          <p className="text-sm text-muted-foreground">Person not found.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-8 pt-8 pb-12 max-w-7xl space-y-5">
      <Card className="border-border/70 bg-card shadow-card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <p className="label-eyebrow">ACTSIX: People</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
              {person.display_name}
            </h1>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {person.phone_number && (
                <span className="inline-flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5" />
                  {person.phone_number}
                </span>
              )}

              {person.email && (
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5" />
                  {person.email}
                </span>
              )}

              {person.whatsapp_enabled && (
                <span className="inline-flex items-center gap-2 rounded-full border border-brand-teal bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                  <MessageCircle className="h-3.5 w-3.5" />
                  WhatsApp ready
                </span>
              )}
            </div>
          </div>

          <Button
            type="button"
            className="actsix-btn-primary rounded-xl"
            onClick={() => setEditing(true)}
          >
            Edit Profile
          </Button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-5">
            <Card className="border-border/70 bg-background/70 p-5">
              <p className="label-eyebrow">Profile Notes</p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {person.notes || "No notes added yet."}
              </p>
            </Card>

            <Card className="border-border/70 bg-background/70 p-5">
              <p className="label-eyebrow">Teams & Roles</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Ministry connections
              </h2>

              {memberships.length === 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-card/70 p-4 text-sm text-muted-foreground">
                  This person is not linked to any teams yet. The next patch will connect team members to People profiles.
                </div>
              )}

              {memberships.length > 0 && (
                <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border/70 bg-card">
                  {memberships.map((membership) => (
                    <div key={membership.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                        <Users className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold tracking-tight">
                          {membership.service_teams?.name || "Service Team"}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {membership.role_name || "No role assigned"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card className="border-border/70 bg-background/70 p-5">
              <p className="label-eyebrow">Upcoming Services</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Scheduled to serve
              </h2>

              {upcomingServiceAssignments.length === 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-card/70 p-4 text-sm text-muted-foreground">
                  No upcoming service assignments linked to this person.
                </div>
              )}

              {upcomingServiceAssignments.length > 0 && (
                <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border/70 bg-card">
                  {upcomingServiceAssignments.map((assignment) => {
                    const linkedService = getServiceForAssignment(assignment.service_id);

                    return (
                      <Link
                        key={assignment.id}
                        to={`/service-planner/services/${assignment.service_id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-teal/5"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
                          <CalendarDays className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold tracking-tight">
                            {linkedService?.title || "Service"}
                          </p>

                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{assignment.role_name}</span>

                            {linkedService?.service_date && (
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {formatDate(linkedService.service_date)}
                              </span>
                            )}

                            {linkedService?.start_time && (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3" />
                                {linkedService.start_time.slice(0, 5)}
                              </span>
                            )}

                            {linkedService?.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {linkedService.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </Card>

            <Card className="border-border/70 bg-background/70 p-5">
              <p className="label-eyebrow">Past Serving History</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Previous assignments
              </h2>

              {pastServiceAssignments.length === 0 && (
                <div className="mt-4 rounded-xl border border-dashed border-border bg-card/70 p-4 text-sm text-muted-foreground">
                  No past service assignments linked to this person yet.
                </div>
              )}

              {pastServiceAssignments.length > 0 && (
                <div className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border/70 bg-card">
                  {pastServiceAssignments.slice(0, 8).map((assignment) => {
                    const linkedService = getServiceForAssignment(assignment.service_id);

                    return (
                      <Link
                        key={assignment.id}
                        to={`/service-planner/services/${assignment.service_id}`}
                        className="flex items-center gap-3 px-4 py-3 transition hover:bg-brand-teal/5"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                          <CalendarDays className="h-4 w-4" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-extrabold tracking-tight">
                            {linkedService?.title || "Service"}
                          </p>

                          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{assignment.role_name}</span>

                            {linkedService?.service_date && (
                              <span className="inline-flex items-center gap-1">
                                <CalendarDays className="h-3 w-3" />
                                {formatDate(linkedService.service_date)}
                              </span>
                            )}

                            {linkedService?.start_time && (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3 w-3" />
                                {linkedService.start_time.slice(0, 5)}
                              </span>
                            )}

                            {linkedService?.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {linkedService.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}

                  {pastServiceAssignments.length > 8 && (
                    <div className="px-4 py-3 text-xs font-bold text-muted-foreground">
                      Showing latest 8 past assignments.
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>

          <Card className="border-border/70 bg-background/70 p-5">
            <p className="label-eyebrow">Profile Summary</p>
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Name
                </p>
                <p className="font-bold">{person.display_name}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Phone
                </p>
                <p className="font-bold">{person.phone_number || "Not added"}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Email
                </p>
                <p className="break-words font-bold">{person.email || "Not added"}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  WhatsApp
                </p>
                <p className="font-bold">
                  {person.whatsapp_enabled ? "Enabled" : "Not enabled"}
                </p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Teams
                </p>
                <p className="font-bold">{memberships.length}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Upcoming Services
                </p>
                <p className="font-bold">{upcomingServiceAssignments.length}</p>
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Past Assignments
                </p>
                <p className="font-bold">{pastServiceAssignments.length}</p>
              </div>
            </div>
          </Card>
        </div>
      </Card>

      {editing && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <form onSubmit={updatePerson} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-eyebrow">ACTSIX: People</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Edit Profile
                  </h2>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={cancelEdit}
                >
                  Close
                </Button>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">First Name</label>
                  <Input
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Last Name</label>
                  <Input
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
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
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Email</label>
                  <Input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
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
                  className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={cancelEdit}
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary rounded-xl">
                  <Save className="h-4 w-4" />
                  Save Profile
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PersonDetail;
