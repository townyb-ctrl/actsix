import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  MessageCircle,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ServiceTeam = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceTeamMember = {
  id: string;
  user_id: string;
  team_id: string;
  person_name: string;
  role_name: string | null;
  phone_number: string | null;
  whatsapp_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const ServicePlannerTeams = () => {
  const { user } = useAuth();

  const [teams, setTeams] = useState<ServiceTeam[]>([]);
  const [members, setMembers] = useState<ServiceTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<ServiceTeam | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");

  const [personName, setPersonName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [memberNotes, setMemberNotes] = useState("");

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();

    return teams.filter((team) => {
      if (!q) return true;

      const teamMembers = members.filter((member) => member.team_id === team.id);

      return (
        team.name.toLowerCase().includes(q) ||
        (team.description || "").toLowerCase().includes(q) ||
        teamMembers.some((member) =>
          [
            member.person_name,
            member.role_name || "",
            member.phone_number || "",
            member.notes || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      );
    });
  }, [teams, members, search]);

  const totalWhatsappEnabled = members.filter((member) => member.whatsapp_enabled).length;

  const fetchTeams = async () => {
    if (!user) return;

    setLoading(true);

    const [{ data: teamData, error: teamError }, { data: memberData, error: memberError }] =
      await Promise.all([
        supabase
          .from("service_teams")
          .select("*")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),

        supabase
          .from("service_team_members")
          .select("*")
          .eq("user_id", user.id)
          .order("person_name", { ascending: true }),
      ]);

    if (teamError) {
      toast.error(teamError.message);
      setLoading(false);
      return;
    }

    if (memberError) {
      toast.error(memberError.message);
      setLoading(false);
      return;
    }

    setTeams(teamData || []);
    setMembers(memberData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTeams();
  }, [user]);

  const resetTeamForm = () => {
    setTeamName("");
    setTeamDescription("");
  };

  const resetMemberForm = () => {
    setPersonName("");
    setRoleName("");
    setPhoneNumber("");
    setWhatsappEnabled(false);
    setMemberNotes("");
  };

  const createTeam = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      toast.error("You need to be signed in.");
      return;
    }

    if (!teamName.trim()) {
      toast.error("Team name is required.");
      return;
    }

    const { error } = await supabase.from("service_teams").insert({
      user_id: user.id,
      name: teamName.trim(),
      description: teamDescription.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Team created");
    resetTeamForm();
    setAddTeamOpen(false);
    fetchTeams();
  };

  const openAddMember = (team: ServiceTeam) => {
    setSelectedTeam(team);
    resetMemberForm();
    setAddMemberOpen(true);
  };

  const createMember = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || !selectedTeam) {
      toast.error("Team not selected.");
      return;
    }

    if (!personName.trim()) {
      toast.error("Person name is required.");
      return;
    }

    const { error } = await supabase.from("service_team_members").insert({
      user_id: user.id,
      team_id: selectedTeam.id,
      person_name: personName.trim(),
      role_name: roleName.trim() || null,
      phone_number: phoneNumber.trim() || null,
      whatsapp_enabled: whatsappEnabled,
      notes: memberNotes.trim() || null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Team member added");
    resetMemberForm();
    setSelectedTeam(null);
    setAddMemberOpen(false);
    fetchTeams();
  };

  const deleteTeam = async (team: ServiceTeam) => {
    const confirmed = window.confirm(
      `Delete "${team.name}"? This will also remove people assigned to this team.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("service_teams")
      .delete()
      .eq("id", team.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Team deleted");
    fetchTeams();
  };

  const deleteMember = async (member: ServiceTeamMember) => {
    const confirmed = window.confirm(`Remove "${member.person_name}" from this team?`);

    if (!confirmed) return;

    const { error } = await supabase
      .from("service_team_members")
      .delete()
      .eq("id", member.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Team member removed");
    fetchTeams();
  };

  const toggleWhatsapp = async (member: ServiceTeamMember) => {
    const { error } = await supabase
      .from("service_team_members")
      .update({
        whatsapp_enabled: !member.whatsapp_enabled,
      })
      .eq("id", member.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    fetchTeams();
  };

  return (
    <div>
      <div className="px-8 pt-8 pb-12 max-w-7xl space-y-4">
        <div>
          <p className="label-eyebrow">ACTSIX: Service Planning</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            Teams
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Create service teams, add people, and prepare for future WhatsApp reminders and communication.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-4 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">Teams</p>
            <div className="mt-2 text-3xl font-extrabold">{teams.length}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Service teams created
            </p>
          </Card>

          <Card className="p-4 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">People</p>
            <div className="mt-2 text-3xl font-extrabold">{members.length}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              People added to teams
            </p>
          </Card>

          <Card className="p-4 border-border/70 bg-card shadow-card">
            <p className="label-eyebrow">WhatsApp Ready</p>
            <div className="mt-2 text-3xl font-extrabold">{totalWhatsappEnabled}</div>
            <p className="mt-1 text-sm text-muted-foreground">
              Enabled for future reminders
            </p>
          </Card>
        </div>

        <Card className="p-4 border-border/70 bg-card/80 shadow-soft">
          <div className="flex flex-wrap items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center">
              <MessageCircle className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-extrabold tracking-tight">WhatsApp Integration</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Planned integration: send reminders, confirmations, and service details to team members through WhatsApp Business API.
              </p>
            </div>

            <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-bold text-muted-foreground">
              Coming Soon
            </span>
          </div>
        </Card>

        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-2xl flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search teams or people..."
              className="h-10 pl-10 border-border/70 bg-card shadow-soft"
            />
          </div>

          <Button
            type="button"
            className="actsix-btn-primary rounded-xl shrink-0"
            onClick={() => setAddTeamOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Team
          </Button>
        </div>

        <div className="space-y-5">
          {loading && (
            <Card className="p-6 border-border/70 bg-card shadow-card">
              <p className="text-sm text-muted-foreground">Loading teams...</p>
            </Card>
          )}

          {!loading && filteredTeams.length === 0 && (
            <Card className="p-6 border-border/70 bg-card shadow-card">
              <p className="text-sm text-muted-foreground">
                No teams found. Add your first team to begin.
              </p>
            </Card>
          )}

          {!loading &&
            filteredTeams.map((team) => {
              const teamMembers = members.filter((member) => member.team_id === team.id);

              return (
                <Card
                  key={team.id}
                  className="border-border/70 bg-card shadow-card overflow-hidden"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-4">
                    <div>
                      <p className="label-eyebrow">Service Team</p>
                      <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                        {team.name}
                      </h2>
                      {team.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {team.description}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => openAddMember(team)}
                      >
                        <Plus className="h-4 w-4" />
                        Add Person
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl text-destructive"
                        onClick={() => deleteTeam(team)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {teamMembers.length === 0 && (
                      <div className="p-4 text-sm text-muted-foreground">
                        No people added to this team yet.
                      </div>
                    )}

                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-4 p-4">
                        <div className="h-10 w-10 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                          <Users className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="font-extrabold tracking-tight truncate">
                            {member.person_name}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            {member.role_name && <span>{member.role_name}</span>}
                            {member.phone_number && <span>{member.phone_number}</span>}
                            {member.notes && <span>{member.notes}</span>}
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant={member.whatsapp_enabled ? "default" : "outline"}
                          className={
                            member.whatsapp_enabled
                              ? "actsix-btn-primary rounded-xl"
                              : "rounded-xl"
                          }
                          onClick={() => toggleWhatsapp(member)}
                          title="Enable for future WhatsApp reminders"
                        >
                          <Bell className="h-4 w-4" />
                          {member.whatsapp_enabled ? "WhatsApp On" : "WhatsApp Off"}
                        </Button>

                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl text-destructive"
                          onClick={() => deleteMember(member)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </Card>
              );
            })}
        </div>
      </div>

      {addTeamOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Service Team</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Add Team
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a team such as Worship, AV, Welcome, Deacons, Elders, Preachers, or Hospitality.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setAddTeamOpen(false)}
              >
                Close
              </Button>
            </div>

            <form onSubmit={createTeam} className="mt-6 space-y-4">
              <div>
                <label className="label-eyebrow">Team Name</label>
                <Input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Worship Team"
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Description</label>
                <Input
                  value={teamDescription}
                  onChange={(event) => setTeamDescription(event.target.value)}
                  placeholder="People who serve in worship services"
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddTeamOpen(false)}
                >
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary rounded-xl">
                  <Plus className="h-4 w-4" />
                  Create Team
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {addMemberOpen && selectedTeam && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Team Member</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Add Person to {selectedTeam.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add people now. Later, ACTSIX can use these details for WhatsApp reminders.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setAddMemberOpen(false)}
              >
                Close
              </Button>
            </div>

            <form onSubmit={createMember} className="mt-6 space-y-4">
              <div>
                <label className="label-eyebrow">Person Name</label>
                <Input
                  value={personName}
                  onChange={(event) => setPersonName(event.target.value)}
                  placeholder="Brandon Townsend"
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Role</label>
                <Input
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="Worship Leader"
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

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
                <label className="label-eyebrow">Notes</label>
                <Input
                  value={memberNotes}
                  onChange={(event) => setMemberNotes(event.target.value)}
                  placeholder="Availability, instrument, serving notes..."
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3 text-sm font-bold text-muted-foreground">
                <input
                  type="checkbox"
                  checked={whatsappEnabled}
                  onChange={(event) => setWhatsappEnabled(event.target.checked)}
                  className="h-4 w-4"
                />
                Enable for future WhatsApp reminders
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddMemberOpen(false)}
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

export default ServicePlannerTeams;
