import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  GripVertical,
  ListChecks,
  MapPin,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ServiceInstance = {
  id: string;
  user_id: string;
  service_type_id: string;
  title: string | null;
  service_date: string;
  start_time: string | null;
  location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type ServiceType = {
  id: string;
  name: string;
};

type OrderItem = {
  id: string;
  user_id: string;
  service_id: string;
  item_type: string;
  title: string;
  details: string | null;
  duration_minutes: number | null;
  sort_order: number;
};

type TeamAssignment = {
  id: string;
  user_id: string;
  service_id: string;
  team_id: string | null;
  team_member_id: string | null;
  role_name: string;
  person_name: string;
  notes: string | null;
  sort_order: number;
};

type ServiceTeam = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
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
};

type ServiceTypeTeam = {
  id: string;
  user_id: string;
  service_type_id: string;
  team_id: string;
};

type ServiceOrderTemplate = {
  id: string;
  user_id: string;
  service_type_id: string;
  name: string;
  description: string | null;
};

type ServiceOrderTemplateItem = {
  id: string;
  user_id: string;
  template_id: string;
  item_type: string;
  title: string;
  details: string | null;
  duration_minutes: number | null;
  sort_order: number;
};

type ServiceTeamRoleRequirement = {
  id: string;
  user_id: string;
  service_type_id: string;
  team_id: string;
  role_name: string;
  required_count: number;
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

const formatDate = (value?: string | null) => {
  if (!value) return "No date";

  return new Date(value + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const ServiceDetail = () => {
  const { serviceId } = useParams();
  const { user } = useAuth();

  const [service, setService] = useState<ServiceInstance | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [roleRequirements, setRoleRequirements] = useState<ServiceTeamRoleRequirement[]>([]);
  const [serviceTeamRoles, setServiceTeamRoles] = useState<ServiceTeamRole[]>([]);
  const [selectedAssignmentTeamId, setSelectedAssignmentTeamId] = useState("");
  const [assignedTeams, setAssignedTeams] = useState<ServiceTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<ServiceTeamMember[]>([]);
  const [template, setTemplate] = useState<ServiceOrderTemplate | null>(null);
  const [templateItems, setTemplateItems] = useState<ServiceOrderTemplateItem[]>([]);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [loading, setLoading] = useState(true);

  const [itemType, setItemType] = useState("Song");
  const [itemTitle, setItemTitle] = useState("");
  const [itemDetails, setItemDetails] = useState("");
  const [itemDuration, setItemDuration] = useState("5");
  const [addOrderOpen, setAddOrderOpen] = useState(false);

  const [addTeamAssignmentOpen, setAddTeamAssignmentOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedTeamMemberId, setSelectedTeamMemberId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [personName, setPersonName] = useState("");
  const [teamNotes, setTeamNotes] = useState("");

  const totalDuration = useMemo(() => {
    return orderItems.reduce((sum, item) => sum + (item.duration_minutes || 0), 0);
  }, [orderItems]);

  const selectedTeamMembers = useMemo(() => {
    if (!selectedTeamId) return [];

    return teamMembers.filter((member) => {
      const sameTeam = member.team_id === selectedTeamId;
      const selectedRole = roleName.trim();

      if (!selectedRole) return sameTeam;

      return sameTeam && (member.role_name || "").trim() === selectedRole;
    });
  }, [teamMembers, selectedTeamId, roleName]);

  const availableSelectedTeamMembers = useMemo(() => {
    return selectedTeamMembers.filter((member) => {
      return !teamAssignments.some(
        (assignment) => assignment.team_member_id === member.id
      );
    });
  }, [selectedTeamMembers, teamAssignments]);

  const visibleTeamAssignments = useMemo(() => {
    if (!selectedAssignmentTeamId) return teamAssignments;

    return teamAssignments.filter(
      (assignment) => assignment.team_id === selectedAssignmentTeamId
    );
  }, [teamAssignments, selectedAssignmentTeamId]);

  const selectedAssignmentTeam = useMemo(() => {
    return assignedTeams.find((team) => team.id === selectedAssignmentTeamId) || null;
  }, [assignedTeams, selectedAssignmentTeamId]);

  const selectedTeamRoleRequirements = useMemo(() => {
    if (!selectedAssignmentTeamId) return [];

    const roleOrder = new Map(
      serviceTeamRoles
        .filter((role) => role.team_id === selectedAssignmentTeamId)
        .map((role) => [role.role_name, role.sort_order])
    );

    return roleRequirements
      .filter((requirement) => requirement.team_id === selectedAssignmentTeamId)
      .sort((a, b) => {
        const aOrder = roleOrder.get(a.role_name) ?? 9999;
        const bOrder = roleOrder.get(b.role_name) ?? 9999;

        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.role_name.localeCompare(b.role_name);
      });
  }, [roleRequirements, selectedAssignmentTeamId, serviceTeamRoles]);

  const getAssignedCountForRole = (teamId: string, role: string) => {
    return teamAssignments.filter(
      (assignment) =>
        assignment.team_id === teamId &&
        assignment.role_name.trim() === role.trim()
    ).length;
  };

  const handleSelectTeamMember = (memberId: string) => {
    setSelectedTeamMemberId(memberId);

    const member = teamMembers.find((item) => item.id === memberId);

    if (!member) {
      setPersonName("");
      return;
    }

    setPersonName(member.person_name);
    setRoleName(member.role_name || "");
  };

  const fetchService = async () => {
    if (!user || !serviceId) return;

    setLoading(true);

    const { data: serviceData, error: serviceError } = await supabase
      .from("service_instances")
      .select("*")
      .eq("id", serviceId)
      .eq("user_id", user.id)
      .single();

    if (serviceError) {
      toast.error(serviceError.message);
      setLoading(false);
      return;
    }

    setService(serviceData);

    const [{ data: typeData }, { data: orderData, error: orderError }, { data: teamData, error: teamError }] =
      await Promise.all([
        supabase
          .from("service_types")
          .select("id, name")
          .eq("id", serviceData.service_type_id)
          .maybeSingle(),

        supabase
          .from("service_order_items")
          .select("*")
          .eq("service_id", serviceId)
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true }),

        supabase
          .from("service_team_assignments")
          .select("*")
          .eq("service_id", serviceId)
          .eq("user_id", user.id)
          .order("sort_order", { ascending: true }),
      ]);

    if (orderError) toast.error(orderError.message);
    if (teamError) toast.error(teamError.message);

    setServiceType(typeData || null);
    setOrderItems(orderData || []);
    setTeamAssignments(teamData || []);

    const { data: serviceTypeTeamLinks, error: serviceTypeTeamError } = await supabase
      .from("service_type_teams")
      .select("*")
      .eq("user_id", user.id)
      .eq("service_type_id", serviceData.service_type_id);

    if (serviceTypeTeamError) {
      toast.error(serviceTypeTeamError.message);
    }

    const linkedTeamIds = (serviceTypeTeamLinks || []).map((link: ServiceTypeTeam) => link.team_id);

    if (linkedTeamIds.length > 0) {
      const [{ data: assignedTeamData, error: assignedTeamError }, { data: linkedMemberData, error: linkedMemberError }] =
        await Promise.all([
          supabase
            .from("service_teams")
            .select("*")
            .eq("user_id", user.id)
            .in("id", linkedTeamIds)
            .order("name", { ascending: true }),

          supabase
            .from("service_team_members")
            .select("*")
            .eq("user_id", user.id)
            .in("team_id", linkedTeamIds)
            .order("person_name", { ascending: true }),
        ]);

      if (assignedTeamError) toast.error(assignedTeamError.message);
      if (linkedMemberError) toast.error(linkedMemberError.message);

      const nextAssignedTeams = assignedTeamData || [];
      const nextTeamMembers = linkedMemberData || [];

      setAssignedTeams(nextAssignedTeams);
      setTeamMembers(nextTeamMembers);

      const rolesToRequire = Array.from(
        new Map(
          nextTeamMembers
            .map((member: ServiceTeamMember) => ({
              team_id: member.team_id,
              role_name: (member.role_name || "General").trim() || "General",
            }))
            .map((role) => [`${role.team_id}:${role.role_name}`, role])
        ).values()
      );

      const requirementsClient = supabase as any;
      const rolesClient = supabase as any;

      const { data: existingTeamRoles, error: teamRolesError } = await rolesClient
        .from("service_team_roles")
        .select("*")
        .eq("user_id", user.id)
        .in("team_id", linkedTeamIds);

      if (teamRolesError) {
        toast.error(teamRolesError.message);
      }

      const existingOrderedRoles = (existingTeamRoles || []) as ServiceTeamRole[];

      const missingTeamRoles = rolesToRequire.filter((role) => {
        return !existingOrderedRoles.some(
          (existingRole) =>
            existingRole.team_id === role.team_id &&
            existingRole.role_name === role.role_name
        );
      });

      if (missingTeamRoles.length > 0) {
        const { error: insertTeamRolesError } = await rolesClient
          .from("service_team_roles")
          .insert(
            missingTeamRoles.map((role) => {
              const existingForTeam = existingOrderedRoles.filter(
                (existingRole) => existingRole.team_id === role.team_id
              );

              const missingBeforeThis = missingTeamRoles.filter(
                (missingRole) =>
                  missingRole.team_id === role.team_id &&
                  missingTeamRoles.indexOf(missingRole) < missingTeamRoles.indexOf(role)
              );

              return {
                user_id: user.id,
                team_id: role.team_id,
                role_name: role.role_name,
                sort_order: existingForTeam.length + missingBeforeThis.length,
              };
            })
          );

        if (insertTeamRolesError) {
          toast.error(insertTeamRolesError.message);
        }
      }

      const { data: refreshedTeamRoles, error: refreshedTeamRolesError } =
        await rolesClient
          .from("service_team_roles")
          .select("*")
          .eq("user_id", user.id)
          .in("team_id", linkedTeamIds)
          .order("sort_order", { ascending: true });

      if (refreshedTeamRolesError) {
        toast.error(refreshedTeamRolesError.message);
      }

      setServiceTeamRoles(refreshedTeamRoles || []);

      const { data: existingRequirements, error: requirementsError } =
        await requirementsClient
          .from("service_team_role_requirements")
          .select("*")
          .eq("user_id", user.id)
          .eq("service_type_id", serviceData.service_type_id)
          .in("team_id", linkedTeamIds);

      if (requirementsError) {
        toast.error(requirementsError.message);
      }

      const existing = (existingRequirements || []) as ServiceTeamRoleRequirement[];

      const missingRequirements = rolesToRequire.filter((role) => {
        return !existing.some(
          (requirement) =>
            requirement.team_id === role.team_id &&
            requirement.role_name === role.role_name
        );
      });

      if (missingRequirements.length > 0) {
        const { error: insertRequirementsError } = await requirementsClient
          .from("service_team_role_requirements")
          .insert(
            missingRequirements.map((role) => ({
              user_id: user.id,
              service_type_id: serviceData.service_type_id,
              team_id: role.team_id,
              role_name: role.role_name,
              required_count: 1,
            }))
          );

        if (insertRequirementsError) {
          toast.error(insertRequirementsError.message);
        }
      }

      const { data: refreshedRequirements, error: refreshedRequirementsError } =
        await requirementsClient
          .from("service_team_role_requirements")
          .select("*")
          .eq("user_id", user.id)
          .eq("service_type_id", serviceData.service_type_id)
          .in("team_id", linkedTeamIds)
          .order("role_name", { ascending: true });

      if (refreshedRequirementsError) {
        toast.error(refreshedRequirementsError.message);
      }

      setRoleRequirements(refreshedRequirements || []);
    } else {
      setAssignedTeams([]);
      setTeamMembers([]);
      setRoleRequirements([]);
      setServiceTeamRoles([]);
    }

    const { data: templateData, error: templateError } = await supabase
      .from("service_order_templates")
      .select("*")
      .eq("user_id", user.id)
      .eq("service_type_id", serviceData.service_type_id)
      .maybeSingle();

    if (templateError) {
      toast.error(templateError.message);
    }

    setTemplate(templateData || null);

    if (templateData) {
      const { data: templateItemData, error: templateItemError } = await supabase
        .from("service_order_template_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("template_id", templateData.id)
        .order("sort_order", { ascending: true });

      if (templateItemError) {
        toast.error(templateItemError.message);
      }

      setTemplateItems(templateItemData || []);
    } else {
      setTemplateItems([]);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchService();
  }, [user, serviceId]);

  useEffect(() => {
    if (assignedTeams.length === 0) {
      setSelectedAssignmentTeamId("");
      return;
    }

    const selectedStillExists = assignedTeams.some(
      (team) => team.id === selectedAssignmentTeamId
    );

    if (!selectedAssignmentTeamId || !selectedStillExists) {
      setSelectedAssignmentTeamId(assignedTeams[0].id);
    }
  }, [assignedTeams, selectedAssignmentTeamId]);

  const addOrderItem = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || !serviceId) return;

    if (!itemTitle.trim()) {
      toast.error("Order item title is required.");
      return;
    }

    const { error } = await supabase.from("service_order_items").insert({
      user_id: user.id,
      service_id: serviceId,
      item_type: itemType,
      title: itemTitle.trim(),
      details: itemDetails.trim() || null,
      duration_minutes: Number(itemDuration) || 5,
      sort_order: orderItems.length,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setItemType("Song");
    setItemTitle("");
    setItemDetails("");
    setItemDuration("5");
    toast.success("Order item added");
    setAddOrderOpen(false);
    fetchService();
  };

  const deleteOrderItem = async (item: OrderItem) => {
    const { error } = await supabase
      .from("service_order_items")
      .delete()
      .eq("id", item.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Order item deleted");
    fetchService();
  };

  const updateRoleRequirementCount = async (
    requirement: ServiceTeamRoleRequirement,
    nextCount: number
  ) => {
    const safeCount = Math.max(0, nextCount);

    const { error } = await (supabase as any)
      .from("service_team_role_requirements")
      .update({ required_count: safeCount })
      .eq("id", requirement.id)
      .eq("user_id", requirement.user_id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setRoleRequirements((previous) =>
      previous.map((item) =>
        item.id === requirement.id
          ? { ...item, required_count: safeCount }
          : item
      )
    );
  };

  const openAssignRole = (requirement: ServiceTeamRoleRequirement) => {
    setSelectedTeamId(requirement.team_id);
    setSelectedTeamMemberId("");
    setRoleName(requirement.role_name);
    setPersonName("");
    setTeamNotes("");
    setAddTeamAssignmentOpen(true);
  };

  const addTeamAssignment = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || !serviceId) return;

    if (!selectedTeamId) {
      toast.error("Please select a team.");
      return;
    }

    if (!selectedTeamMemberId) {
      toast.error("Please select a person from the team.");
      return;
    }

    if (!roleName.trim() || !personName.trim()) {
      toast.error("Role and person are required.");
      return;
    }

    const matchingRequirement = roleRequirements.find(
      (requirement) =>
        requirement.team_id === selectedTeamId &&
        requirement.role_name.trim() === roleName.trim()
    );

    if (matchingRequirement) {
      const assignedCount = getAssignedCountForRole(
        selectedTeamId,
        matchingRequirement.role_name
      );

      if (assignedCount >= matchingRequirement.required_count) {
        toast.error("This role already has the required number of people assigned.");
        return;
      }
    }

    const { error } = await supabase.from("service_team_assignments").insert({
      user_id: user.id,
      service_id: serviceId,
      team_id: selectedTeamId,
      team_member_id: selectedTeamMemberId,
      role_name: roleName.trim(),
      person_name: personName.trim(),
      notes: teamNotes.trim() || null,
      sort_order: teamAssignments.length,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setSelectedTeamId("");
    setSelectedTeamMemberId("");
    setRoleName("");
    setPersonName("");
    setTeamNotes("");
    toast.success("Team member added");
    setAddTeamAssignmentOpen(false);
    fetchService();
  };

  const deleteTeamAssignment = async (assignment: TeamAssignment) => {
    const { error } = await supabase
      .from("service_team_assignments")
      .delete()
      .eq("id", assignment.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Team member removed");
    fetchService();
  };

  const applyTemplateToService = async () => {
    if (!user || !serviceId || !template || templateItems.length === 0) {
      toast.error("No template items found for this service type.");
      return;
    }

    if (orderItems.length > 0) {
      const confirmed = window.confirm(
        "This service already has order items. Do you want to append the template items?"
      );

      if (!confirmed) return;
    }

    setApplyingTemplate(true);

    const startingSortOrder = orderItems.length;

    const itemsToInsert = templateItems.map((item, index) => ({
      user_id: user.id,
      service_id: serviceId,
      item_type: item.item_type,
      title: item.title,
      details: item.details,
      duration_minutes: item.duration_minutes || 5,
      sort_order: startingSortOrder + index,
    }));

    const { error } = await supabase
      .from("service_order_items")
      .insert(itemsToInsert);

    if (error) {
      toast.error(error.message);
      setApplyingTemplate(false);
      return;
    }

    toast.success("Template applied to service");
    setApplyingTemplate(false);
    fetchService();
  };

  if (loading) {
    return (
      <div className="px-8 py-12">
        <p className="text-sm text-muted-foreground">Loading service...</p>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="px-8 py-12">
        <Card className="p-6 border-border/70 bg-card shadow-card">
          <p className="text-sm text-muted-foreground">Service not found.</p>
</Card>
      </div>
    );
  }

  return (
    <div>
      <div className="px-8 pt-8 pb-12 max-w-7xl space-y-5">
<div>
          <p className="label-eyebrow">ACTSIX: Service Planning</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            {service.title || serviceType?.name || "Service"}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-3.5 w-3.5" />
              {formatDate(service.service_date)}
            </span>

            {service.start_time && (
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" />
                {service.start_time.slice(0, 5)}
              </span>
            )}

            {service.location && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5" />
                {service.location}
              </span>
            )}

            <span className="inline-flex items-center gap-2">
              <ListChecks className="h-3.5 w-3.5" />
              {totalDuration} min planned
            </span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(340px,0.75fr)]">
          <Card className="border-border/70 bg-card shadow-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border p-4">
              <div>
                <p className="label-eyebrow">Service Flow</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                  Order of Service
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  className="actsix-btn-primary h-11 w-11 rounded-full p-0"
                  onClick={() => setAddOrderOpen(true)}
                  title="Add service element"
                >
                  <Plus className="h-5 w-5" />
                  <span className="sr-only">Add service element</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={applyTemplateToService}
                  disabled={!templateItems.length || applyingTemplate}
                >
                  {applyingTemplate ? "Applying..." : "Apply Template"}
                </Button>
              </div>
            </div>

            <div className="divide-y divide-border">
              {orderItems.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">
                  No order items yet. Add songs, welcome, sermon, announcements, and other service elements.
                </div>
              )}

              {orderItems.map((item, index) => (
                <div key={item.id} className="flex items-center gap-4 p-4">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />

                  <div className="h-9 w-9 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center text-sm font-extrabold">
                    {index + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold tracking-tight">
                      {item.title}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{item.item_type}</span>
                      <span>{item.duration_minutes || 5} min</span>
                      {item.details && <span>{item.details}</span>}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground/55 transition hover:bg-muted/40 hover:text-destructive"
                    onClick={() => deleteOrderItem(item)}
                    aria-label="Delete order item"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border/70 bg-card shadow-card overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-border p-4">
              <div>
                <p className="label-eyebrow">Service Team</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                  Assign people
                </h2>
              </div>

              <Button
                type="button"
                className="actsix-btn-primary h-11 w-11 rounded-full p-0"
                onClick={() => {
                  setSelectedTeamId(selectedAssignmentTeamId);
                  setSelectedTeamMemberId("");
                  setRoleName("");
                  setPersonName("");
                  setTeamNotes("");
                  setAddTeamAssignmentOpen(true);
                }}
                title="Add team member"
              >
                <Plus className="h-5 w-5" />
                <span className="sr-only">Add team member</span>
              </Button>
            </div>

            {assignedTeams.length > 0 && (
              <div className="border-b border-border px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {assignedTeams.map((team) => {
                    const active = selectedAssignmentTeamId === team.id;
                    const count = teamAssignments.filter(
                      (assignment) => assignment.team_id === team.id
                    ).length;

                    return (
                      <button
                        key={team.id}
                        type="button"
                        onClick={() => setSelectedAssignmentTeamId(team.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                          active
                            ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                            : "border-border bg-background text-muted-foreground hover:border-brand-teal hover:text-brand-teal"
                        }`}
                      >
                        {team.name}
                        <span className="ml-1 opacity-70">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {assignedTeams.length === 0 && (
              <div className="border-b border-border p-4 text-sm text-muted-foreground">
                No teams assigned to this service type yet. Go to Services ? Manage Teams to assign teams first.
              </div>
            )}

            <div className="p-3">
              {selectedAssignmentTeam && selectedTeamRoleRequirements.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-background/70 p-5 text-sm text-muted-foreground">
                  No roles found for this team yet. Add roles to the team first.
                </div>
              )}

              {selectedTeamRoleRequirements.length > 0 && (
                <div className="overflow-hidden rounded-xl border border-border/70 bg-background/70">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-border px-3 py-2.5">
                    <div>
                      <p className="label-eyebrow">Positions</p>
                      <h3 className="mt-0.5 font-extrabold tracking-tight">
                        {selectedAssignmentTeam?.name}
                      </h3>
                    </div>

                    <div className="self-center text-[11px] font-bold text-muted-foreground">
                      Needed / Assigned
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {selectedTeamRoleRequirements.map((requirement) => {
                      const assignedCount = getAssignedCountForRole(
                        requirement.team_id,
                        requirement.role_name
                      );

                      const assignedPeople = teamAssignments.filter(
                        (assignment) =>
                          assignment.team_id === requirement.team_id &&
                          assignment.role_name.trim() === requirement.role_name.trim()
                      );

                      const emptySlots = Math.max(
                        requirement.required_count - assignedCount,
                        0
                      );

                      const complete =
                        requirement.required_count > 0 &&
                        assignedCount >= requirement.required_count;

                      return (
                        <div key={requirement.id} className="px-3 py-3">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0">
                              <h4 className="text-base font-extrabold tracking-tight">
                                {requirement.role_name}
                              </h4>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                {assignedCount} / {requirement.required_count} assigned
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm font-bold text-muted-foreground transition hover:border-brand-teal hover:text-brand-teal"
                                onClick={() =>
                                  updateRoleRequirementCount(
                                    requirement,
                                    requirement.required_count - 1
                                  )
                                }
                                aria-label={`Decrease ${requirement.role_name} requirement`}
                              >
                                −
                              </button>

                              <span
                                className={`min-w-8 rounded-full border px-2 py-0.5 text-center text-xs font-bold ${
                                  complete
                                    ? "border-brand-teal bg-brand-teal/10 text-brand-teal"
                                    : "border-border bg-card text-muted-foreground"
                                }`}
                              >
                                {requirement.required_count}
                              </span>

                              <button
                                type="button"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-sm font-bold text-muted-foreground transition hover:border-brand-teal hover:text-brand-teal"
                                onClick={() =>
                                  updateRoleRequirementCount(
                                    requirement,
                                    requirement.required_count + 1
                                  )
                                }
                                aria-label={`Increase ${requirement.role_name} requirement`}
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="mt-2 grid gap-1.5">
                            {assignedPeople.map((assignment) => (
                              <div
                                key={assignment.id}
                                className="flex items-center gap-2 rounded-lg bg-card px-2.5 py-2"
                              >
                                <div className="h-7 w-7 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                                  <Users className="h-3.5 w-3.5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                  <div className="truncate text-sm font-extrabold tracking-tight">
                                    {assignment.person_name}
                                  </div>
                                  <div className="mt-0.5 text-xs text-muted-foreground">
                                    {assignment.notes || requirement.role_name}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground/45 transition hover:bg-muted/40 hover:text-destructive"
                                  onClick={() => deleteTeamAssignment(assignment)}
                                  aria-label="Remove team member"
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                                </button>
                              </div>
                            ))}

                            {Array.from({ length: emptySlots }).map((_, index) => (
                              <button
                                key={`${requirement.id}-slot-${index}`}
                                type="button"
                                className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-card/70 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition hover:border-brand-teal hover:bg-brand-teal/5 hover:text-brand-teal"
                                onClick={() => openAssignRole(requirement)}
                              >
                                <span className="font-bold">
                                  Empty slot
                                </span>
                                <span className="text-lg leading-none">+</span>
                              </button>
                            ))}

                            {requirement.required_count === 0 && (
                              <div className="rounded-xl border border-dashed border-border bg-card/70 px-3 py-2 text-sm text-muted-foreground">
                                No people required for this position.
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>


      {addTeamAssignmentOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Service Team</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Add Team Member
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Choose a person from the teams assigned to this service type.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setAddTeamAssignmentOpen(false)}
              >
                Close
              </Button>
            </div>

            <form onSubmit={addTeamAssignment} className="mt-6 space-y-4">
              <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="label-eyebrow">Selected Position</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {selectedTeamId && (
                    <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
                      {assignedTeams.find((team) => team.id === selectedTeamId)?.name || "Selected team"}
                    </span>
                  )}

                  {roleName.trim() && (
                    <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                      {roleName}
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="label-eyebrow">Choose Person</p>

                <div className="mt-2 overflow-hidden rounded-2xl border border-border/70 bg-background/70">
                  {availableSelectedTeamMembers.length === 0 && (
                    <div className="p-5 text-sm text-muted-foreground">
                      No available people found for this position.
                    </div>
                  )}

                  {availableSelectedTeamMembers.map((member) => {
                    const active = selectedTeamMemberId === member.id;

                    return (
                      <button
                        key={member.id}
                        type="button"
                        className={`flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition last:border-b-0 ${
                          active
                            ? "bg-brand-teal/10 text-brand-teal"
                            : "bg-card text-foreground hover:bg-brand-teal/5"
                        }`}
                        onClick={() => handleSelectTeamMember(member.id)}
                      >
                        <div className="h-9 w-9 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                          <Users className="h-3.5 w-3.5" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-extrabold tracking-tight">
                            {member.person_name}
                          </div>
                          <div className="mt-0.5 text-xs text-muted-foreground">
                            {member.role_name || "No role assigned"}
                            {member.phone_number ? ` • ${member.phone_number}` : ""}
                          </div>
                        </div>

                        {active && (
                          <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal">
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="label-eyebrow">Notes</label>
                <Input
                  value={teamNotes}
                  onChange={(event) => setTeamNotes(event.target.value)}
                  placeholder="Optional notes..."
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddTeamAssignmentOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  className="actsix-btn-primary rounded-xl"
                  disabled={!selectedTeamMemberId}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Assign Person
                </Button>
              </div>
            </form>


          </Card>
        </div>
      )}

      {addOrderOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Order of Service</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Add Service Element
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add a song, welcome, sermon, prayer, announcement, or other part of the service.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setAddOrderOpen(false)}
              >
                Close
              </Button>
            </div>

            <form onSubmit={addOrderItem} className="mt-6 space-y-4">
              <div>
                <label className="label-eyebrow">Element Type</label>
                <select
                  value={itemType}
                  onChange={(event) => setItemType(event.target.value)}
                  className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                >
                  <option>Song</option>
                  <option>Welcome</option>
                  <option>Announcements</option>
                  <option>Prayer</option>
                  <option>Offering</option>
                  <option>Sermon</option>
                  <option>Communion</option>
                  <option>General</option>
                </select>
              </div>

              <div>
                <label className="label-eyebrow">Title</label>
                <Input
                  value={itemTitle}
                  onChange={(event) => setItemTitle(event.target.value)}
                  placeholder="Item title..."
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Duration</label>
                <Input
                  type="number"
                  min="1"
                  value={itemDuration}
                  onChange={(event) => setItemDuration(event.target.value)}
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Notes</label>
                <Input
                  value={itemDetails}
                  onChange={(event) => setItemDetails(event.target.value)}
                  placeholder="Optional notes, key, scripture, or details..."
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddOrderOpen(false)}
                >
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary rounded-xl">
                  <Plus className="h-3.5 w-3.5" />
                  Add Element
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

    </div>
  );
};

export default ServiceDetail;
