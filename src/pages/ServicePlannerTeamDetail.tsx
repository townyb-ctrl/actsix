import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Bell,
  MoreVertical,
  Plus,
  Save,
  Trash2,
  Users,
  X,
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

const ServicePlannerTeamDetail = () => {
  const { teamId } = useParams();
  const { user } = useAuth();

  const [team, setTeam] = useState<ServiceTeam | null>(null);
  const [members, setMembers] = useState<ServiceTeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingTeam, setEditingTeam] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");

  const [personName, setPersonName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [memberNotes, setMemberNotes] = useState("");
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(null);

  const roles = useMemo(() => {
    const roleNames = members
      .map((member) => member.role_name?.trim())
      .filter(Boolean) as string[];

    return Array.from(new Set(roleNames));
  }, [members]);

  const groupedMembers = useMemo(() => {
    const groups = members.reduce<Record<string, ServiceTeamMember[]>>((acc, member) => {
      const role = member.role_name?.trim() || "No Role Assigned";

      if (!acc[role]) {
        acc[role] = [];
      }

      acc[role].push(member);
      return acc;
    }, {});

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "No Role Assigned") return 1;
      if (b === "No Role Assigned") return -1;
      return a.localeCompare(b);
    });
  }, [members]);

  const filteredGroupedMembers = useMemo(() => {
    if (!selectedRoleFilter) return groupedMembers;

    return groupedMembers.filter(([role]) => role === selectedRoleFilter);
  }, [groupedMembers, selectedRoleFilter]);

  const fetchTeam = async () => {
    if (!user || !teamId) return;

    setLoading(true);

    const [{ data: teamData, error: teamError }, { data: memberData, error: memberError }] =
      await Promise.all([
        supabase
          .from("service_teams")
          .select("*")
          .eq("user_id", user.id)
          .eq("id", teamId)
          .single(),

        supabase
          .from("service_team_members")
          .select("*")
          .eq("user_id", user.id)
          .eq("team_id", teamId)
          .order("role_name", { ascending: true })
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

    setTeam(teamData);
    setMembers(memberData || []);
    setEditTeamName(teamData.name);
    setEditTeamDescription(teamData.description || "");
    setLoading(false);
  };

  useEffect(() => {
    fetchTeam();
  }, [user, teamId]);

  const resetMemberForm = () => {
    setPersonName("");
    setRoleName("");
    setPhoneNumber("");
    setWhatsappEnabled(false);
    setMemberNotes("");
  };

  const cancelTeamEdit = () => {
    if (!team) return;

    setEditTeamName(team.name);
    setEditTeamDescription(team.description || "");
    setEditingTeam(false);
  };

  const updateTeam = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !team) return;

    if (!editTeamName.trim()) {
      toast.error("Team name is required.");
      return;
    }

    const { error } = await supabase
      .from("service_teams")
      .update({
        name: editTeamName.trim(),
        description: editTeamDescription.trim() || null,
      })
      .eq("id", team.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Team updated");
    setEditingTeam(false);
    setTeamMenuOpen(false);
    fetchTeam();
  };

  const createMember = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !teamId) {
      toast.error("Team not selected.");
      return;
    }

    if (!personName.trim()) {
      toast.error("Person name is required.");
      return;
    }

    const { error } = await supabase.from("service_team_members").insert({
      user_id: user.id,
      team_id: teamId,
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
    setAddPersonOpen(false);
    fetchTeam();
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
    fetchTeam();
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

    fetchTeam();
  };

  if (loading) {
    return (
      <div className="px-8 py-12">
        <p className="text-sm text-muted-foreground">Loading team...</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="px-8 py-12">
        <Card className="p-6 border-border/70 bg-card shadow-card">
          <p className="text-sm text-muted-foreground">Team not found.</p>
</Card>
      </div>
    );
  }

  return (
    <div>
      <div className="px-8 pt-8 pb-12 max-w-7xl space-y-5">
<Card className="border-border/70 bg-card shadow-card overflow-visible">
          <div className="border-b border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label-eyebrow">ACTSIX: Service Team</p>
                <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
                  {team.name}
                </h1>
                {team.description && (
                  <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                    {team.description}
                  </p>
                )}
                {roles.length > 0 && (
                  <p className="mt-2 text-sm text-muted-foreground">
                    Click a role to filter the people list.
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedRoleFilter && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setSelectedRoleFilter(null)}
                  >
                    Clear Filter
                  </Button>
                )}

                <Button
                  type="button"
                  className="actsix-btn-primary h-11 w-11 rounded-full p-0"
                  onClick={() => setAddPersonOpen(true)}
                  title="Add person"
                >
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">Add person</span>
                </Button>

                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 w-11 rounded-full p-0"
                    onClick={() => setTeamMenuOpen((open) => !open)}
                    title="Team options"
                  >
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Team options</span>
                  </Button>

                  {teamMenuOpen && (
                    <div className="absolute right-0 top-12 z-50 w-44 rounded-2xl border border-border bg-card p-2 shadow-lg">
                      <button
                        type="button"
                        className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm font-bold text-foreground hover:bg-background"
                        onClick={() => {
                          setEditingTeam(true);
                          setTeamMenuOpen(false);
                        }}
                      >
                        Edit Team
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {roles.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRoleFilter(null)}
                  className={`rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                    selectedRoleFilter === null
                      ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                      : "border-border bg-background text-muted-foreground hover:border-brand-teal hover:text-brand-teal"
                  }`}
                >
                  All Roles
                </button>

                {roles.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => setSelectedRoleFilter(role)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-bold transition ${
                      selectedRoleFilter === role
                        ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                        : "border-border bg-background text-muted-foreground hover:border-brand-teal hover:text-brand-teal"
                    }`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            {members.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-background/70 p-6 text-sm text-muted-foreground">
                No people added to this team yet.
              </div>
            )}

            {members.length > 0 && filteredGroupedMembers.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-background/70 p-6 text-sm text-muted-foreground">
                No people found for this role filter.
              </div>
            )}

            {filteredGroupedMembers.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredGroupedMembers.map(([role, roleMembers]) => (
                  <div
                    key={role}
                    className="flex min-h-[220px] flex-col rounded-2xl border border-border/70 bg-background/70 overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-4">
                      <div className="min-w-0">
                        <p className="label-eyebrow">Role</p>
                        <h3 className="mt-1 truncate text-lg font-extrabold tracking-tight">
                          {role}
                        </h3>
                      </div>

                      <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold text-muted-foreground">
                        {roleMembers.length} {roleMembers.length === 1 ? "person" : "people"}
                      </span>
                    </div>

                    <div className="flex-1 divide-y divide-border">
                      {roleMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                          <div className="h-9 w-9 rounded-xl bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-extrabold tracking-tight">
                              {member.person_name}
                            </div>

                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              {member.phone_number && <span>{member.phone_number}</span>}
                              {member.whatsapp_enabled && (
                                <span className="font-bold text-brand-teal">WhatsApp ready</span>
                              )}
                              {member.notes && <span>{member.notes}</span>}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-lg p-0 text-muted-foreground hover:text-brand-teal"
                              onClick={() => toggleWhatsapp(member)}
                              title="Toggle future WhatsApp reminders"
                            >
                              <Bell className="h-4 w-4" />
                            </Button>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 rounded-lg p-0 text-destructive"
                              onClick={() => deleteMember(member)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {editingTeam && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
            <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
              <form onSubmit={updateTeam} className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="label-eyebrow">Service Team</p>
                    <h2 className="text-xl font-extrabold tracking-tight">
                      Edit Team
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Update the team name and description.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={cancelTeamEdit}
                  >
                    Close
                  </Button>
                </div>

                <div>
                  <label className="label-eyebrow">Team Title</label>
                  <Input
                    value={editTeamName}
                    onChange={(event) => setEditTeamName(event.target.value)}
                    placeholder="Worship Team"
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Description</label>
                  <Input
                    value={editTeamDescription}
                    onChange={(event) => setEditTeamDescription(event.target.value)}
                    placeholder="People who serve in worship services"
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={cancelTeamEdit}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>

                  <Button type="submit" className="actsix-btn-primary rounded-xl">
                    <Save className="h-4 w-4" />
                    Save Team
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {addPersonOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
            <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-eyebrow">Team Members</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Add Person
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a person to this team and assign their role for future service planning.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddPersonOpen(false)}
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
                    onClick={() => setAddPersonOpen(false)}
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
    </div>
  );
};

export default ServicePlannerTeamDetail;
