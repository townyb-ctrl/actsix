import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Mail,
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
import { PageHeader } from "@/components/PageHeader";

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

const ServicePlannerTeamsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<ServiceTeam[]>([]);
  const [members, setMembers] = useState<ServiceTeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [addTeamOpen, setAddTeamOpen] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");

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

  const createTeam = async (event: FormEvent) => {
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

  const messageTeam = (team: ServiceTeam) => {
    toast.info(`Bulk messaging for ${team.name} is coming soon.`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Service Planner"
        title="Teams"
        subtitle="Create service teams, define roles, and prepare future team communication."
        actions={
          <Button
            type="button"
            className="actsix-btn-primary shrink-0"
            onClick={() => setAddTeamOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add Team
          </Button>
        }
      />

      <div className="w-full space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <div className="actsix-panel-soft p-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search teams or roles..."
              className="h-11 rounded-xl border-border/70 bg-background pl-10 shadow-none"
            />
          </div>
        </div>

        <div>
          {loading && (
            <Card className="actsix-loading-state">
              <p className="text-sm text-muted-foreground">Loading teams...</p>
            </Card>
          )}

          {!loading && filteredTeams.length === 0 && (
            <Card className="actsix-empty-state">
              <p className="text-sm text-muted-foreground">
                No teams found. Add your first team to begin.
              </p>
            </Card>
          )}

          {!loading && filteredTeams.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredTeams.map((team) => {
                const teamMembers = getTeamMembers(team.id);
                const roles = getTeamRoles(team.id);

                return (
                  <Card
                    key={team.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open service team ${team.name}`}
                    onClick={() => navigate(`/service-planner/teams/${team.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        navigate(`/service-planner/teams/${team.id}`);
                      }
                    }}
                    className="actsix-panel-soft flex min-h-[220px] cursor-pointer flex-col overflow-hidden border-border/60 transition hover:-translate-y-0.5 hover:border-brand-teal/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal/40"
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
                        className="rounded-xl flex-1"
                        onClick={(event) => {
                          event.stopPropagation();
                          messageTeam(team);
                        }}
                        title="Send message to this team"
                      >
                        <Mail className="h-4 w-4" />
                        Message
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl text-destructive"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteTeam(team);
                        }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <Card className="actsix-panel w-full max-w-2xl p-5 sm:p-6">
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
                  className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                />
              </div>

              <div>
                <label className="label-eyebrow">Description</label>
                <Input
                  value={teamDescription}
                  onChange={(event) => setTeamDescription(event.target.value)}
                  placeholder="People who serve in worship services"
                  className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
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
    </div>
  );
};

export default ServicePlannerTeamsPage;
