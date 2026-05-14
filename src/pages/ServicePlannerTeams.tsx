import { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Mail,
  Plus,
  Search,
  Settings,
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
  const [manageTeamOpen, setManageTeamOpen] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<ServiceTeam | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");

  const [personName, setPersonName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [memberNotes, setMemberNotes] = useState("");

  const getTeamMembers = (teamId: string) =>
    members.filter((member) => member.team_id === teamId);

  const getTeamRoles = (teamId: string) => {
    const roleNames = getTeamMembers(teamId)
      .map((member) => member.role_name?.trim())
      .filter(Boolean) as string[];

    return Array.from(new Set(roleNames));
  };

  const filteredTeams = useMemo(() => {
    const q = search.trim().toLowerCase();

    return teams.filter((team) => {
      if (!q) return true;

      const teamMembers = members.filter((member) => member.team_id === team.id);
      const roles = teamMembers.map((member) => member.role_name || "").join(" ");

      return (
        team.name.toLowerCase().includes(q) ||
        (team.description || "").toLowerCase().includes(q) ||
        roles.toLowerCase().includes(q)
      );
    });
  }, [teams, members, search]);

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

  const openManageTeam = (team: ServiceTeam) => {
    setSelectedTeam(team);
    resetMemberForm();
    setManageTeamOpen(true);
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

    if (selectedTeam?.id === team.id) {
      setManageTeamOpen(false);
      setSelectedTeam(null);
    }

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

  const messageTeam = (team: ServiceTeam) => {
    toast.info(`Bulk messaging for ${team.name} is coming soon.`);
  };

  const selectedTeamMembers = selectedTeam ? getTeamMembers(selectedTeam.id) : [];
  const selectedTeamRoles = selectedTeam ? getTeamRoles(selectedTeam.id) : [];

  return (
    <div>
      <div className="px-8 pt-8 pb-12 max-w-7xl space-y-4">
        <div>
          <p className="label-eyebrow">ACTSIX: Service Planning</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            Teams
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Create service teams, define roles, and prepare future team communication.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-2xl flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search teams or roles..."
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

        <div>
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

          {!loading && filteredTeams.length > 0 && (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredTeams.map((team) => {
                const teamMembers = getTeamMembers(team.id);
                const roles = getTeamRoles(team.id);

                return (
                  <Card
                    key={team.id}
                    className="flex min-h-[230px] flex-col border-border/70 bg-card shadow-card overflow-hidden"
                  >
                    <div className="flex-1 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="label-eyebrow">Service Team</p>
                          <h2 className="mt-1 text-xl font-extrabold tracking-tight truncate">
                            {team.name}
                          </h2>

                          {team.description && (
                            <p className="mt-2 text-sm leading-6 text-muted-foreground line-clamp-2">
                              {team.description}
                            </p>
                          )}
                        </div>

                        <div className="h-11 w-11 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                          <Users className="h-5 w-5" />
                        </div>
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="font-bold text-foreground">
                          {teamMembers.length}
                        </span>
                        <span>{teamMembers.length === 1 ? "person" : "people"}</span>
                      </div>

                      <div className="mt-4">
                        <p className="label-eyebrow">Roles</p>

                        {roles.length === 0 ? (
                          <p className="mt-2 text-sm text-muted-foreground">
                            No roles created yet.
                          </p>
                        ) : (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {roles.slice(0, 6).map((role) => (
                              <span
                                key={role}
                                className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold text-muted-foreground"
                              >
                                {role}
                              </span>
                            ))}

                            {roles.length > 6 && (
                              <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs font-bold text-muted-foreground">
                                +{roles.length - 6} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 border-t border-border p-4">
                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() => messageTeam(team)}
                        title="Send message to this team"
                      >
                        <Mail className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl flex-1"
                        onClick={() => openManageTeam(team)}
                      >
                        <Settings className="h-4 w-4" />
                        Manage
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
                  </Card>
                );
              })}
            </div>
          )}
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

      {manageTeamOpen && selectedTeam && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-4xl max-h-[86vh] overflow-auto border-border/70 bg-card shadow-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Manage Team</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  {selectedTeam.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add people, assign roles, and prepare future communication.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setManageTeamOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="rounded-2xl border border-border/70 bg-background/70 overflow-hidden">
                <div className="border-b border-border p-4">
                  <p className="label-eyebrow">People</p>
                  <h3 className="mt-1 font-extrabold tracking-tight">
                    {selectedTeamMembers.length} assigned
                  </h3>
                </div>

                <div className="divide-y divide-border">
                  {selectedTeamMembers.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground">
                      No people added to this team yet.
                    </div>
                  )}

                  {selectedTeamMembers.map((member) => (
                    <div key={member.id} className="flex items-center gap-3 p-3">
                      <div className="h-8 w-8 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                        <Users className="h-4 w-4" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-extrabold tracking-tight">
                          {member.person_name}
                        </div>

                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                          {member.role_name && <span>{member.role_name}</span>}
                          {member.phone_number && <span>{member.phone_number}</span>}
                          {member.whatsapp_enabled && (
                            <span className="font-bold text-brand-teal">WhatsApp ready</span>
                          )}
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-brand-teal"
                        onClick={() => toggleWhatsapp(member)}
                        title="Toggle future WhatsApp reminders"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 rounded-lg p-0 text-destructive"
                        onClick={() => deleteMember(member)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <form onSubmit={createMember} className="space-y-4 rounded-2xl border border-border/70 bg-background/70 p-4">
                <div>
                  <p className="label-eyebrow">Add Person</p>
                  <h3 className="mt-1 font-extrabold tracking-tight">
                    Team member details
                  </h3>
                </div>

                <div>
                  <label className="label-eyebrow">Person Name</label>
                  <Input
                    value={personName}
                    onChange={(event) => setPersonName(event.target.value)}
                    placeholder="Brandon Townsend"
                    className="mt-2 border-border/70 bg-card"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Role</label>
                  <Input
                    value={roleName}
                    onChange={(event) => setRoleName(event.target.value)}
                    placeholder="Worship Leader"
                    className="mt-2 border-border/70 bg-card"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Phone / WhatsApp Number</label>
                  <Input
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                    placeholder="+27..."
                    className="mt-2 border-border/70 bg-card"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Notes</label>
                  <Input
                    value={memberNotes}
                    onChange={(event) => setMemberNotes(event.target.value)}
                    placeholder="Availability, instrument, serving notes..."
                    className="mt-2 border-border/70 bg-card"
                  />
                </div>

                <label className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3 text-sm font-bold text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={whatsappEnabled}
                    onChange={(event) => setWhatsappEnabled(event.target.checked)}
                    className="h-4 w-4"
                  />
                  Enable for future WhatsApp reminders
                </label>

                <Button type="submit" className="actsix-btn-primary rounded-xl w-full">
                  <Plus className="h-4 w-4" />
                  Add Person
                </Button>
              </form>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ServicePlannerTeams;
