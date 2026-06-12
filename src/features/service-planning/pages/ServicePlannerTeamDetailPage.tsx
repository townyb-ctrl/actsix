import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  GripVertical,
  MessageCircle,
  MoreVertical,
  Plus,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { PeopleSearchSelect } from "@/components/people/PeopleSearchSelect";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { formatPhoneForDisplay, normalizePhoneForStorage } from "@/lib/phone";

type ServiceTeam = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  whatsapp_group_url: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceTeamMember = {
  id: string;
  user_id: string;
  team_id: string;
  person_id: string | null;
  person_name: string;
  role_name: string | null;
  phone_number: string | null;
  whatsapp_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceTeamRole = {
  id: string;
  user_id: string;
  team_id: string;
  role_name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type Person = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string | null;
  display_name: string;
  avatar_url: string | null;
  phone_number: string | null;
  email: string | null;
  whatsapp_enabled: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SortableRoleCardProps = {
  role: string;
  disabled?: boolean;
  children: ReactNode;
};

const SortableRoleCard = ({ role, disabled = false, children }: SortableRoleCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: role,
    disabled,
    transition: {
      duration: 240,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`flex min-h-[190px] cursor-grab flex-col rounded-xl border bg-background/70 overflow-hidden will-change-transform transition-[box-shadow,border-color,opacity] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing ${
        isDragging
          ? "z-20 scale-[1.01] border-brand-teal bg-background shadow-md ring-2 ring-brand-teal/15"
          : "border-border/70"
      }`}
    >
      {children}
    </div>
  );
};

const ServicePlannerTeamDetailPage = () => {
  const { teamId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { person: currentPerson } = useCurrentPerson();

  const [team, setTeam] = useState<ServiceTeam | null>(null);
  const [members, setMembers] = useState<ServiceTeamMember[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [serviceTeamRoles, setServiceTeamRoles] = useState<ServiceTeamRole[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingTeam, setEditingTeam] = useState(false);
  const [teamMenuOpen, setTeamMenuOpen] = useState(false);
  const [editTeamName, setEditTeamName] = useState("");
  const [editTeamDescription, setEditTeamDescription] = useState("");
  const [editTeamWhatsAppGroupUrl, setEditTeamWhatsAppGroupUrl] = useState("");

  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [personName, setPersonName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [memberNotes, setMemberNotes] = useState("");
  const [addPersonOpen, setAddPersonOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");
  const [draggedRole, setDraggedRole] = useState<string | null>(null);
  const [dragOverRole, setDragOverRole] = useState<string | null>(null);
  const [roleOrderPreview, setRoleOrderPreview] = useState<string[] | null>(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string | null>(null);

  const roles = useMemo(() => {
    const memberRoleNames = Array.from(
      new Set(
        members
          .map((member) => member.role_name?.trim())
          .filter(Boolean) as string[]
      )
    );

    const orderedRoles = roleOrderPreview || serviceTeamRoles.map((role) => role.role_name);

    const missingRoles = memberRoleNames
      .filter((role) => !orderedRoles.includes(role))
      .sort((a, b) => a.localeCompare(b));

    return [...orderedRoles, ...missingRoles];
  }, [members, serviceTeamRoles, roleOrderPreview]);

  const groupedMembers = useMemo(() => {
    const memberRoleNames = Array.from(
      new Set(
        members
          .map((member) => member.role_name?.trim())
          .filter(Boolean) as string[]
      )
    );

    const explicitRoleNames = serviceTeamRoles.map((role) => role.role_name);

    const allRoleNames = [
      ...explicitRoleNames,
      ...memberRoleNames.filter((role) => !explicitRoleNames.includes(role)),
    ];

    const groups = allRoleNames.reduce<Record<string, ServiceTeamMember[]>>((acc, role) => {
      acc[role] = [];
      return acc;
    }, {});

    members.forEach((member) => {
      const role = member.role_name?.trim() || "No Role Assigned";

      if (!groups[role]) {
        groups[role] = [];
      }

      groups[role].push(member);
    });

    const roleOrder = new Map(
      serviceTeamRoles.map((role) => [role.role_name, role.sort_order])
    );

    return Object.entries(groups).sort(([a], [b]) => {
      if (a === "No Role Assigned") return 1;
      if (b === "No Role Assigned") return -1;

      const aOrder = roleOrder.get(a) ?? 9999;
      const bOrder = roleOrder.get(b) ?? 9999;

      if (aOrder !== bOrder) return aOrder - bOrder;
      return a.localeCompare(b);
    });
  }, [members, serviceTeamRoles]);

  const filteredGroupedMembers = useMemo(() => {
    if (!selectedRoleFilter) return groupedMembers;

    return groupedMembers.filter(([role]) => role === selectedRoleFilter);
  }, [groupedMembers, selectedRoleFilter]);

  const roleDragSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const sortableRoleNames = useMemo(() => {
    return filteredGroupedMembers
      .map(([role]) => role)
      .filter((role) => role !== "No Role Assigned");
  }, [filteredGroupedMembers]);

  const handleRoleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeRole = String(active.id);
    const overRole = String(over.id);

    const oldIndex = sortableRoleNames.indexOf(activeRole);
    const newIndex = sortableRoleNames.indexOf(overRole);

    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const nextRoles = arrayMove(sortableRoleNames, oldIndex, newIndex);

    // Update immediately so the dropped card does not visually snap back.
    setServiceTeamRoles((previous) =>
      previous
        .map((role) => ({
          ...role,
          sort_order: nextRoles.indexOf(role.role_name),
        }))
        .sort((a, b) => a.sort_order - b.sort_order)
    );

    const saved = await saveRoleOrder(nextRoles);

    if (!saved) {
      fetchTeam();
      return;
    }

    toast.success("Role order updated");
  };

  const fetchTeam = async () => {
    if (!user || !teamId) return;

    setLoading(true);

    const [
      { data: teamData, error: teamError },
      { data: memberData, error: memberError },
      { data: peopleData, error: peopleError },
    ] =
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

        (supabase as any)
          .from("people")
          .select("*")
          .eq("workspace_id", currentPerson?.workspace_id ?? "00000000-0000-0000-0000-000000000000")
          .order("display_name", { ascending: true }),
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

    if (peopleError) {
      toast.error(peopleError.message);
      setLoading(false);
      return;
    }

    const nextMembers = memberData || [];
    setTeam(teamData);
    setMembers(nextMembers);
    setPeople(peopleData || []);
    setEditTeamName(teamData.name);
    setEditTeamDescription(teamData.description || "");
    setEditTeamWhatsAppGroupUrl(teamData.whatsapp_group_url || "");

    const roleNames = Array.from(
      new Set(
        nextMembers
          .map((member: ServiceTeamMember) => member.role_name?.trim())
          .filter(Boolean) as string[]
      )
    );

    const rolesClient = supabase as any;

    const { data: existingRoles, error: rolesError } = await rolesClient
      .from("service_team_roles")
      .select("*")
      .eq("user_id", user.id)
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true });

    if (rolesError) {
      toast.error(rolesError.message);
      setLoading(false);
      return;
    }

    const existing = (existingRoles || []) as ServiceTeamRole[];

    const missingRoles = roleNames.filter(
      (roleName) => !existing.some((role) => role.role_name === roleName)
    );

    if (missingRoles.length > 0) {
      const { error: insertRolesError } = await rolesClient
        .from("service_team_roles")
        .insert(
          missingRoles.map((roleName, index) => ({
            user_id: user.id,
            team_id: teamId,
            role_name: roleName,
            sort_order: existing.length + index,
          }))
        );

      if (insertRolesError) {
        toast.error(insertRolesError.message);
        setLoading(false);
        return;
      }
    }

    const { data: refreshedRoles, error: refreshedRolesError } = await rolesClient
      .from("service_team_roles")
      .select("*")
      .eq("user_id", user.id)
      .eq("team_id", teamId)
      .order("sort_order", { ascending: true });

    if (refreshedRolesError) {
      toast.error(refreshedRolesError.message);
      setLoading(false);
      return;
    }

    setServiceTeamRoles(refreshedRoles || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchTeam();
  }, [user, teamId, currentPerson?.workspace_id]);

  const resetMemberForm = () => {
    setSelectedPersonId("");
    setPersonName("");
    setRoleName("");
    setPhoneNumber("");
    setMemberNotes("");
  };

  const cancelTeamEdit = () => {
    if (!team) return;

    setEditTeamName(team.name);
    setEditTeamDescription(team.description || "");
    setEditTeamWhatsAppGroupUrl(team.whatsapp_group_url || "");
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
        whatsapp_group_url: editTeamWhatsAppGroupUrl.trim() || null,
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

  const openAddPersonForRole = (role: string) => {
    setSelectedPersonId("");
    setRoleName(role === "No Role Assigned" ? "" : role);
    setPersonName("");
    setPhoneNumber("");
    setMemberNotes("");
    setAddPersonOpen(true);
  };

  const createRole = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !teamId) {
      toast.error("Team not selected.");
      return;
    }

    const cleanedRoleName = newRoleName.trim();

    if (!cleanedRoleName) {
      toast.error("Role name is required.");
      return;
    }

    const roleAlreadyExists = roles.some(
      (role) => role.toLowerCase() === cleanedRoleName.toLowerCase()
    );

    if (roleAlreadyExists) {
      toast.error("That role already exists.");
      return;
    }

    const { error } = await (supabase as any).from("service_team_roles").insert({
      user_id: user.id,
      team_id: teamId,
      role_name: cleanedRoleName,
      sort_order: serviceTeamRoles.length,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Role added");
    setNewRoleName("");
    setAddRoleOpen(false);
    fetchTeam();
  };

  const openTeamWhatsAppGroup = () => {
    if (!team?.whatsapp_group_url) {
      toast.error("No WhatsApp group link saved for this team.");
      return;
    }

    window.open(team.whatsapp_group_url, "_blank", "noopener,noreferrer");
  };

  const deleteTeam = async () => {
    if (!team) return;

    const confirmed = window.confirm(
      `Delete "${team.name}"? This will also remove people assigned to this team.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("service_teams")
      .delete()
      .eq("id", team.id)
      .eq("user_id", team.user_id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Team deleted");
    navigate("/service-planner/teams");
  };

  const handleSelectExistingPerson = (personId: string) => {
    setSelectedPersonId(personId);

    if (!personId) {
      setPersonName("");
      setPhoneNumber("");
      return;
    }

    const selectedPerson = people.find((person) => person.id === personId);

    if (!selectedPerson) return;

    setPersonName(selectedPerson.display_name);
    setPhoneNumber(formatPhoneForDisplay(selectedPerson.phone_number) || "");
  };

  const createPersonFromSearch = async (displayName: string) => {
    if (!user || !currentPerson?.workspace_id) return;

    const cleanedName = displayName.trim();

    if (!cleanedName) {
      toast.error("Person name is required.");
      return;
    }

    const { first_name, last_name } = splitDisplayName(cleanedName);

    const { data: newPerson, error } = await (supabase as any)
      .from("people")
      .insert({
        user_id: user.id,
        workspace_id: currentPerson.workspace_id,
        first_name,
        last_name,
        display_name: cleanedName,
        phone_number: null,
        membership_status: "Member",
        whatsapp_enabled: false,
        notes: null,
      })
      .select("*")
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    setPeople((currentPeople) =>
      [...currentPeople, newPerson].sort((a, b) =>
        a.display_name.localeCompare(b.display_name)
      )
    );

    setSelectedPersonId(newPerson.id);
    setPersonName(newPerson.display_name);
    setPhoneNumber("");

    toast.success("People profile created");
  };

  const createMember = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !teamId) {
      toast.error("Team not selected.");
      return;
    }

    if (!selectedPersonId) {
      toast.error("Choose a People profile first.");
      return;
    }

    const selectedPerson = people.find((person) => person.id === selectedPersonId);

    if (!selectedPerson) {
      toast.error("Selected People profile could not be found.");
      return;
    }

    const { error } = await supabase.from("service_team_members").insert({
      user_id: user.id,
      team_id: teamId,
      person_id: selectedPerson.id,
      person_name: selectedPerson.display_name,
      role_name: roleName.trim() || null,
      phone_number: normalizePhoneForStorage(selectedPerson.phone_number),
      whatsapp_enabled: false,
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

  const moveRole = async (roleName: string, direction: "up" | "down") => {
    const orderedRoles = roles.filter((role) => role !== "No Role Assigned");
    const currentIndex = orderedRoles.indexOf(roleName);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedRoles.length) {
      return;
    }

    const nextRoles = [...orderedRoles];
    const [movedRole] = nextRoles.splice(currentIndex, 1);
    nextRoles.splice(nextIndex, 0, movedRole);

    const rolesClient = supabase as any;

    const updates = nextRoles.map((role, index) =>
      rolesClient
        .from("service_team_roles")
        .update({ sort_order: index })
        .eq("user_id", user?.id)
        .eq("team_id", teamId)
        .eq("role_name", role)
    );

    const results = await Promise.all(updates);
    const error = results.find((result) => result.error)?.error;

    if (error) {
      toast.error(error.message);
      return;
    }

    setServiceTeamRoles((previous) =>
      previous
        .map((role) => ({
          ...role,
          sort_order: nextRoles.indexOf(role.role_name),
        }))
        .sort((a, b) => a.sort_order - b.sort_order)
    );
  };

  const moveRoleInList = (list: string[], fromRole: string, toRole: string) => {
    if (fromRole === toRole) return list;

    const fromIndex = list.indexOf(fromRole);
    const toIndex = list.indexOf(toRole);

    if (fromIndex < 0 || toIndex < 0) return list;

    const nextList = [...list];
    const [movedRole] = nextList.splice(fromIndex, 1);
    nextList.splice(toIndex, 0, movedRole);

    return nextList;
  };

  const saveRoleOrder = async (nextRoles: string[]) => {
    const rolesClient = supabase as any;

    const results = await Promise.all(
      nextRoles.map((role, index) =>
        rolesClient
          .from("service_team_roles")
          .update({ sort_order: index })
          .eq("user_id", user?.id)
          .eq("team_id", teamId)
          .eq("role_name", role)
      )
    );

    const error = results.find((result) => result.error)?.error;

    if (error) {
      toast.error(error.message);
      return false;
    }

    setServiceTeamRoles((previous) =>
      previous
        .map((role) => ({
          ...role,
          sort_order: nextRoles.indexOf(role.role_name),
        }))
        .sort((a, b) => a.sort_order - b.sort_order)
    );

    return true;
  };

  const reorderRole = async (fromRole: string, toRole: string) => {
    if (fromRole === toRole) return;

    const orderedRoles = roles.filter((role) => role !== "No Role Assigned");
    const fromIndex = orderedRoles.indexOf(fromRole);
    const toIndex = orderedRoles.indexOf(toRole);

    if (fromIndex < 0 || toIndex < 0) return;

    const nextRoles = [...orderedRoles];
    const [movedRole] = nextRoles.splice(fromIndex, 1);
    nextRoles.splice(toIndex, 0, movedRole);

    const saved = await saveRoleOrder(nextRoles);

    if (saved) {
      toast.success("Role order updated");
    }
  };

  const splitDisplayName = (displayName: string) => {
    const parts = displayName.trim().split(/\s+/).filter(Boolean);

    if (parts.length === 0) {
      return {
        first_name: "Unknown",
        last_name: null,
      };
    }

    if (parts.length === 1) {
      return {
        first_name: parts[0],
        last_name: null,
      };
    }

    return {
      first_name: parts[0],
      last_name: parts.slice(1).join(" "),
    };
  };

  const createProfileFromTeamMember = async (member: ServiceTeamMember) => {
    if (!user || !currentPerson?.workspace_id) return;

    if (member.person_id) {
      toast.error("This team member is already linked to a People profile.");
      return;
    }

    const confirmed = window.confirm(
      `Create a People profile for "${member.person_name}" and link it to this team member?`
    );

    if (!confirmed) return;

    const { first_name, last_name } = splitDisplayName(member.person_name);

    const { data: newPerson, error: createPersonError } = await (supabase as any)
      .from("people")
      .insert({
        user_id: user.id,
        workspace_id: currentPerson.workspace_id,
        first_name,
        last_name,
        display_name: member.person_name,
        phone_number: normalizePhoneForStorage(member.phone_number),
        whatsapp_enabled: false,
        notes: member.notes || null,
      })
      .select("*")
      .single();

    if (createPersonError) {
      toast.error(createPersonError.message);
      return;
    }

    const { error: linkMemberError } = await (supabase as any)
      .from("service_team_members")
      .update({ person_id: newPerson.id })
      .eq("id", member.id)
      .eq("user_id", member.user_id);

    if (linkMemberError) {
      toast.error(linkMemberError.message);
      return;
    }

    const { error: linkAssignmentsError } = await (supabase as any)
      .from("service_team_assignments")
      .update({ person_id: newPerson.id })
      .eq("user_id", user.id)
      .eq("team_member_id", member.id)
      .is("person_id", null);

    if (linkAssignmentsError) {
      toast.error(linkAssignmentsError.message);
      return;
    }

    toast.success("People profile created and linked");
    fetchTeam();
  };


  if (loading) {
    return (
      <div className="px-4 py-12 sm:px-6 xl:px-8 2xl:px-10">
        <p className="text-sm text-muted-foreground">Loading team...</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className="px-4 py-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="actsix-panel-soft p-4 sm:p-5">
          <p className="text-sm text-muted-foreground">Team not found.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Service Team"
        title={team.name}
        subtitle={team.description || "Manage team roles and linked People profiles for service planning."}
        actions={
          <>
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

                {team.whatsapp_group_url && (
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={openTeamWhatsAppGroup}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Open Group
                  </Button>
                )}

                <Button
                  type="button"
                  className="actsix-btn-primary h-10 w-10 rounded-lg p-0"
                  onClick={() => setAddRoleOpen(true)}
                  title="Add role"
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">Add role</span>
                </Button>

                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 w-10 rounded-lg p-0"
                    onClick={() => setTeamMenuOpen((open) => !open)}
                    title="Team options"
                  >
                    <MoreVertical className="h-5 w-5" />
                    <span className="sr-only">Team options</span>
                  </Button>

                  {teamMenuOpen && (
                    <div className="absolute right-0 top-12 z-50 w-44 rounded-xl border border-border/70 bg-background p-2 shadow-md">
                      <button
                        type="button"
                        className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-foreground hover:bg-muted/60"
                        onClick={() => {
                          setEditingTeam(true);
                          setTeamMenuOpen(false);
                        }}
                      >
                        Edit Team
                      </button>

                      <button
                        type="button"
                        className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-bold text-destructive hover:bg-destructive/5"
                        onClick={() => {
                          setTeamMenuOpen(false);
                          deleteTeam();
                        }}
                      >
                        Delete Team
                      </button>
                    </div>
                  )}
                </div>
          </>
        }
      />

      <div className="w-full space-y-5 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="actsix-panel overflow-visible">
            {roles.length > 0 && (
              <div className="border-b border-border/70 p-3">
                <div className="flex flex-wrap gap-2">
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
              </div>
            )}

          <div className="p-4">
            {members.length === 0 && (
              <div className="actsix-empty-state min-h-[9rem] text-left">
                No people added to this team yet.
              </div>
            )}

            {members.length > 0 && filteredGroupedMembers.length === 0 && (
              <div className="actsix-empty-state min-h-[9rem] text-left">
                No people found for this role filter.
              </div>
            )}

            {filteredGroupedMembers.length > 0 && (
              <DndContext
                sensors={roleDragSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleRoleDragEnd}
              >
                <SortableContext items={sortableRoleNames} strategy={rectSortingStrategy}>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {filteredGroupedMembers.map(([role, roleMembers], roleIndex) => (
                  <SortableRoleCard
                    key={role}
                    role={role}
                    disabled={role === "No Role Assigned"}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className="inline-flex h-8 w-8 shrink-0 cursor-grab items-center justify-center rounded-md bg-transparent text-muted-foreground/70 transition hover:bg-brand-teal/5 hover:text-brand-teal active:cursor-grabbing"
                          title="Click and hold to drag"
                          aria-label="Drag role to reorder"
                        >
                          <GripVertical className="h-4 w-4" />
                        </div>

                        <div className="min-w-0">
                          <p className="label-eyebrow">Role</p>
                          <h3 className="mt-0.5 truncate text-lg font-extrabold tracking-tight">
                            {role}
                          </h3>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">

                        <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-bold text-muted-foreground">
                          {roleMembers.length} {roleMembers.length === 1 ? "person" : "people"}
                        </span>

                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-brand-teal/10 hover:text-brand-teal"
                          onClick={() => openAddPersonForRole(role)}
                          aria-label={`Add person to ${role}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex-1 divide-y divide-border">
                      {roleMembers.length === 0 && (
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-muted-foreground transition hover:bg-brand-teal/5 hover:text-brand-teal"
                          onClick={() => openAddPersonForRole(role)}
                        >
                          <span>Add first person to this role</span>
                          <Plus className="h-4 w-4" />
                        </button>
                      )}

                      {roleMembers.map((member) => (
                        <div key={member.id} className="flex items-center gap-3 px-4 py-3">
                          <PersonAvatar
                            name={member.person_name}
                            avatarUrl={people.find((person) => person.id === member.person_id)?.avatar_url}
                            size="md"
                            shape="rounded"
                          />

                          <div className="min-w-0 flex-1">
                            {member.person_id ? (
                              <Link
                                to={`/people/${member.person_id}`}
                                className="truncate text-sm font-extrabold tracking-tight text-foreground transition hover:text-brand-teal"
                              >
                                {member.person_name}
                              </Link>
                            ) : (
                              <div className="truncate text-sm font-extrabold tracking-tight">
                                {member.person_name}
                              </div>
                            )}

                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                              {member.phone_number && <span>{formatPhoneForDisplay(member.phone_number)}</span>}
                              {member.notes && <span>{member.notes}</span>}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1">


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
                  </SortableRoleCard>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </Card>

        {editingTeam && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
            <Card className="actsix-panel w-full max-w-2xl overflow-visible p-4 sm:p-5">
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
                    className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Description</label>
                  <Input
                    value={editTeamDescription}
                    onChange={(event) => setEditTeamDescription(event.target.value)}
                    placeholder="People who serve in worship services"
                    className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">WhatsApp Group Invite Link</label>
                  <Input
                    value={editTeamWhatsAppGroupUrl}
                    onChange={(event) => setEditTeamWhatsAppGroupUrl(event.target.value)}
                    placeholder="https://chat.whatsapp.com/..."
                    className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Paste the invite link for this team's existing WhatsApp group.
                  </p>
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

        {addRoleOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
            <Card className="actsix-panel w-full max-w-lg p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-eyebrow">Team Role</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Add Role
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Add a serving position such as Worship Leader, Vocals, Drums, AV, or Welcome.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddRoleOpen(false)}
                >
                  Close
                </Button>
              </div>

              <form onSubmit={createRole} className="mt-4 space-y-4">
                <div>
                  <label className="label-eyebrow">Role Name</label>
                  <Input
                    value={newRoleName}
                    onChange={(event) => setNewRoleName(event.target.value)}
                    placeholder="Vocals"
                    className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setAddRoleOpen(false)}
                  >
                    Cancel
                  </Button>

                  <Button type="submit" className="actsix-btn-primary rounded-xl">
                    <Plus className="h-4 w-4" />
                    Add Role
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        )}

        {addPersonOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
            <Card className="actsix-panel w-full max-w-2xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-eyebrow">Team Members</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Add Person
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose an existing People profile and assign their role for future service planning.
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

              <form onSubmit={createMember} className="mt-4 space-y-4">
                <div>
                  <label className="label-eyebrow">Link Existing Person Profile</label>
                  <div className="mt-2">
                    <PeopleSearchSelect
                      people={people}
                      selectedPersonId={selectedPersonId}
                      onSelect={handleSelectExistingPerson}
                      placeholder="Search by name, email, or phone..."
                      emptyText="No matching People profiles found."
                      onCreatePerson={createPersonFromSearch}
                    />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Service team members must be linked to a People profile. Create the profile first if this person is not listed.
                  </p>

                  {selectedPersonId && (
                    <div className="mt-3 rounded-xl border border-brand-teal/20 bg-brand-teal/5 px-3 py-2 text-xs text-muted-foreground">
                      Selected profile will be added as{" "}
                      <span className="font-bold text-foreground">{personName}</span>
                      {phoneNumber ? (
                        <>
                          {" "}| <span>{phoneNumber}</span>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>


                <div>
                  <label className="label-eyebrow">Role</label>
                  <Input
                    value={roleName}
                    onChange={(event) => setRoleName(event.target.value)}
                    placeholder="Worship Leader"
                    className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                  />
                </div>


                <div>
                  <label className="label-eyebrow">Notes</label>
                  <Input
                    value={memberNotes}
                    onChange={(event) => setMemberNotes(event.target.value)}
                    placeholder="Availability, instrument, serving notes..."
                    className="mt-2 h-11 rounded-xl border-border/70 bg-background shadow-none"
                  />
                </div>


                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setAddPersonOpen(false)}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    className="actsix-btn-primary rounded-xl"
                    disabled={!selectedPersonId}
                  >
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

export default ServicePlannerTeamDetailPage;
