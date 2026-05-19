import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  GripVertical,
  History,
  ListChecks,
  MapPin,
  MessageCircle,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentPerson } from "@/hooks/useCurrentPerson";
import { logActivity } from "@/lib/activityLog";

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
  person_id: string | null;
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
  whatsapp_group_url: string | null;
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
};

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

type ActivityLog = {
  id: string;
  actor_person_id: string | null;
  entity_type: string;
  entity_id: string;
  action_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  people?: {
    display_name: string;
    avatar_url: string | null;
  } | null;
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
  const { person: currentPerson } = useCurrentPerson();

  const [service, setService] = useState<ServiceInstance | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignment[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [roleRequirements, setRoleRequirements] = useState<ServiceTeamRoleRequirement[]>([]);
  const [serviceTeamRoles, setServiceTeamRoles] = useState<ServiceTeamRole[]>([]);
  const [selectedAssignmentTeamId, setSelectedAssignmentTeamId] = useState("");
  const [assignedTeams, setAssignedTeams] = useState<ServiceTeam[]>([]);
  const [teamMembers, setTeamMembers] = useState<ServiceTeamMember[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
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
  const [selectedAssignmentPersonId, setSelectedAssignmentPersonId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [personName, setPersonName] = useState("");
  const [teamNotes, setTeamNotes] = useState("");

  const [whatsAppAssignment, setWhatsAppAssignment] = useState<TeamAssignment | null>(null);
  const [whatsAppMessage, setWhatsAppMessage] = useState("");
  const [reminderCenterOpen, setReminderCenterOpen] = useState(false);

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
      setSelectedAssignmentPersonId("");
      setPersonName("");
      return;
    }

    setSelectedAssignmentPersonId(member.person_id || "");
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

    const [
      { data: typeData },
      { data: orderData, error: orderError },
      { data: teamData, error: teamError },
      { data: activityData, error: activityError },
    ] =
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

        (supabase as any)
          .from("activity_logs")
          .select("id, actor_person_id, entity_type, entity_id, action_type, title, description, metadata, created_at")
          .eq("user_id", user.id)
          .eq("entity_type", "service")
          .eq("entity_id", serviceId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

    if (orderError) toast.error(orderError.message);
    if (teamError) toast.error(teamError.message);
    if (activityError) toast.error(activityError.message);

    const actorPersonIds = Array.from(
      new Set(
        (activityData ?? [])
          .map((activity: ActivityLog) => activity.actor_person_id)
          .filter(Boolean)
      )
    );

    let actorPeople: { id: string; display_name: string; avatar_url: string | null }[] = [];

    if (actorPersonIds.length > 0) {
      const { data: actorPeopleData, error: actorPeopleError } = await (supabase as any)
        .from("people")
        .select("id, display_name, avatar_url")
        .eq("user_id", user.id)
        .in("id", actorPersonIds);

      if (actorPeopleError) {
        toast.error(actorPeopleError.message);
      }

      actorPeople = actorPeopleData || [];
    }

    const enrichedActivityLogs = (activityData ?? []).map((activity: ActivityLog) => ({
      ...activity,
      people:
        actorPeople.find((person) => person.id === activity.actor_person_id) || null,
    }));

    setServiceType(typeData || null);
    setOrderItems(orderData || []);
    setTeamAssignments(teamData || []);
    setActivityLogs(enrichedActivityLogs);

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
      const [
        { data: assignedTeamData, error: assignedTeamError },
        { data: linkedMemberData, error: linkedMemberError },
        { data: peopleData, error: peopleError },
      ] =
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

          (supabase as any)
            .from("people")
            .select("*")
            .eq("user_id", user.id)
            .order("display_name", { ascending: true }),
        ]);

      if (assignedTeamError) toast.error(assignedTeamError.message);
      if (linkedMemberError) toast.error(linkedMemberError.message);
      if (peopleError) toast.error(peopleError.message);

      const nextAssignedTeams = assignedTeamData || [];
      const nextTeamMembers = linkedMemberData || [];

      setAssignedTeams(nextAssignedTeams);
      setTeamMembers(nextTeamMembers);
      setPeople(peopleData || []);

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
      setPeople([]);
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

  const logServiceActivity = async (
    actionType: string,
    title: string,
    description?: string | null,
    metadata: Record<string, unknown> = {}
  ) => {
    if (!user || !serviceId) return;

    const { data, error } = await logActivity({
      userId: user.id,
      actorPersonId: currentPerson?.id || null,
      entityType: "service",
      entityId: serviceId,
      actionType,
      title,
      description,
      metadata,
    });

    if (error) {
      toast.error(`Could not log activity: ${error.message}`);
      return;
    }

    if (data) {
      setActivityLogs((currentLogs) => [
        {
          ...data,
          people: currentPerson
            ? {
                display_name: currentPerson.display_name,
                avatar_url: currentPerson.avatar_url,
              }
            : null,
        },
        ...currentLogs,
      ].slice(0, 20));
    }
  };

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
    await logServiceActivity(
      "order_item_added",
      "Order item added",
      itemTitle.trim(),
      { item_type: itemType, duration_minutes: Number(itemDuration) || 5 }
    );

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

    await logServiceActivity(
      "order_item_deleted",
      "Order item deleted",
      item.title,
      { order_item_id: item.id, item_type: item.item_type }
    );

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

    await logServiceActivity(
      "role_requirement_updated",
      "Role requirement updated",
      `${requirement.role_name}: ${requirement.required_count} → ${safeCount}`,
      {
        requirement_id: requirement.id,
        role_name: requirement.role_name,
        previous_count: requirement.required_count,
        next_count: safeCount,
      }
    );

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
    setSelectedAssignmentPersonId("");
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

    const selectedMember = teamMembers.find((member) => member.id === selectedTeamMemberId);
    const nextPersonId = selectedAssignmentPersonId || selectedMember?.person_id || null;

    if (selectedMember && nextPersonId && selectedMember.person_id !== nextPersonId) {
      const { error: linkMemberError } = await (supabase as any)
        .from("service_team_members")
        .update({ person_id: nextPersonId })
        .eq("id", selectedMember.id)
        .eq("user_id", selectedMember.user_id);

      if (linkMemberError) {
        toast.error(linkMemberError.message);
        return;
      }
    }

    const { error } = await supabase.from("service_team_assignments").insert({
      user_id: user.id,
      service_id: serviceId,
      team_id: selectedTeamId,
      team_member_id: selectedTeamMemberId,
      person_id: nextPersonId,
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
    setSelectedAssignmentPersonId("");
    setRoleName("");
    setPersonName("");
    setTeamNotes("");
    await logServiceActivity(
      "team_member_assigned",
      "Team member assigned",
      `${personName.trim()} — ${roleName.trim()}`,
      {
        team_id: selectedTeamId,
        team_member_id: selectedTeamMemberId,
        person_id: nextPersonId,
        role_name: roleName.trim(),
      }
    );

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

    await logServiceActivity(
      "team_member_removed",
      "Team member removed",
      `${assignment.person_name} — ${assignment.role_name}`,
      {
        assignment_id: assignment.id,
        team_id: assignment.team_id,
        person_id: assignment.person_id,
        role_name: assignment.role_name,
      }
    );

    toast.success("Team member removed");
    fetchService();
  };

  const getTeamMemberForAssignment = (assignment: TeamAssignment) => {
    if (!assignment.team_member_id) return null;

    return teamMembers.find((member) => member.id === assignment.team_member_id) || null;
  };

  const normalizeWhatsAppNumber = (phoneNumber?: string | null) => {
    if (!phoneNumber) return "";

    const digits = phoneNumber.replace(/\D/g, "");

    if (!digits) return "";

    if (digits.startsWith("27")) return digits;
    if (digits.startsWith("0")) return `27${digits.slice(1)}`;

    return digits;
  };

  const buildWhatsAppMessage = (assignment: TeamAssignment) => {
    const serviceName = service?.title || serviceType?.name || "the service";
    const serviceDate = formatDate(service?.service_date);
    const serviceTime = service?.start_time ? service.start_time.slice(0, 5) : "";

    return [
      `Hi ${assignment.person_name},`,
      "",
      `Just a reminder that you are scheduled for ${assignment.role_name} at ${serviceName} on ${serviceDate}${serviceTime ? ` at ${serviceTime}` : ""}.`,
      "",
      "Please reply Confirmed or Unavailable.",
      "",
      "Thanks so much!"
    ].join("\n");
  };

  const buildTeamWhatsAppMessage = () => {
    const serviceName = serviceType?.name || service?.title || "Service";
    const serviceDate = formatDate(service?.service_date);
    const serviceTime = service?.start_time ? service.start_time.slice(0, 5) : "";

    const assignmentsByTeam = teamAssignments.reduce<Record<string, TeamAssignment[]>>(
      (acc, assignment) => {
        const teamName =
          assignedTeams.find((team) => team.id === assignment.team_id)?.name ||
          "Service Team";

        if (!acc[teamName]) {
          acc[teamName] = [];
        }

        acc[teamName].push(assignment);
        return acc;
      },
      {}
    );

    const teamSections = Object.entries(assignmentsByTeam).flatMap(
      ([teamName, assignments]) => [
        `${teamName}:`,
        ...assignments.map(
          (assignment) => `- ${assignment.person_name} — ${assignment.role_name}`
        ),
        "",
      ]
    );

    return [
      "Hi team 👋",
      "",
      `You are serving at the ${serviceName} on ${serviceDate}${serviceTime ? ` at ${serviceTime}` : ""}.`,
      "",
      ...teamSections,
      "Please reply with a 👍 once you have seen this.",
      "",
      "Thanks so much!"
    ].join("\n").trim();
  };

  const copyTeamWhatsAppMessage = async () => {
    if (teamAssignments.length === 0) {
      toast.error("No team members are assigned to this service yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(buildTeamWhatsAppMessage());
      toast.success("WhatsApp team message copied");
    } catch {
      toast.error("Could not copy message. Please try again.");
    }
  };

  const openWhatsAppComposer = (assignment: TeamAssignment) => {
    const member = getTeamMemberForAssignment(assignment);

    if (!member?.phone_number) {
      toast.error("No WhatsApp number found for this person.");
      return;
    }

    setWhatsAppAssignment(assignment);
    setWhatsAppMessage(buildWhatsAppMessage(assignment));
  };

  const openWhatsAppLink = () => {
    if (!whatsAppAssignment) return;

    const member = getTeamMemberForAssignment(whatsAppAssignment);
    const number = normalizeWhatsAppNumber(member?.phone_number);

    if (!number) {
      toast.error("No valid WhatsApp number found.");
      return;
    }

    const encodedMessage = encodeURIComponent(whatsAppMessage.trim());
    window.open(`https://wa.me/${number}?text=${encodedMessage}`, "_blank", "noopener,noreferrer");
  };

  const getWhatsAppGroupOpenUrl = (url: string) => {
    const inviteCode = url.match(/chat\.whatsapp\.com\/([^/?#]+)/)?.[1];

    if (!inviteCode) {
      return url;
    }

    return `whatsapp://chat?code=${inviteCode}`;
  };

  const openSelectedTeamWhatsAppGroup = () => {
    if (!selectedAssignmentTeam?.whatsapp_group_url) {
      toast.error("No WhatsApp group link saved for this team.");
      return;
    }

    window.open(
      getWhatsAppGroupOpenUrl(selectedAssignmentTeam.whatsapp_group_url),
      "_blank",
      "noopener,noreferrer"
    );
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

    await logServiceActivity(
      "template_applied",
      "Template applied",
      `${itemsToInsert.length} order item${itemsToInsert.length === 1 ? "" : "s"} added from template`,
      { template_id: template.id, item_count: itemsToInsert.length }
    );

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
<div className="flex flex-wrap items-start justify-between gap-4">
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

          <Button
            type="button"
            className="actsix-btn-primary rounded-xl"
            onClick={() => setReminderCenterOpen(true)}
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp Reminder
          </Button>
        </div>

        {reminderCenterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <Card className="w-full max-w-3xl border-border/70 bg-card p-6 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="label-eyebrow">WhatsApp Reminder</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Service Reminder Center
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Copy a clean reminder for this service, grouped by team and role.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setReminderCenterOpen(false)}
                >
                  Close
                </Button>
              </div>

              <div className="mt-5 rounded-2xl border border-border/70 bg-background/70 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  Message Preview
                </p>
                <pre className="mt-3 max-h-[420px] overflow-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                  {teamAssignments.length > 0
                    ? buildTeamWhatsAppMessage()
                    : "Assign team members to this service to generate a WhatsApp reminder."}
                </pre>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setReminderCenterOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  className="actsix-btn-primary rounded-xl"
                  onClick={copyTeamWhatsAppMessage}
                  disabled={teamAssignments.length === 0}
                >
                  <MessageCircle className="h-4 w-4" />
                  Copy Team Message
                </Button>
              </div>
            </Card>
          </div>
        )}

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
                  setSelectedAssignmentPersonId("");
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

                    <div className="flex items-center gap-2 self-center">
                      {selectedAssignmentTeam?.whatsapp_group_url && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 rounded-lg px-2.5 text-xs"
                          onClick={openSelectedTeamWhatsAppGroup}
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Open Group
                        </Button>
                      )}

                      <div className="text-[11px] font-bold text-muted-foreground">
                        Needed / Assigned
                      </div>
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
                                  {assignment.person_id ? (
                                    <Link
                                      to={`/people/${assignment.person_id}`}
                                      className="block truncate text-sm font-extrabold tracking-tight text-foreground transition hover:text-brand-teal"
                                    >
                                      {assignment.person_name}
                                    </Link>
                                  ) : (
                                    <div className="truncate text-sm font-extrabold tracking-tight">
                                      {assignment.person_name}
                                    </div>
                                  )}
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                    <span>{assignment.notes || requirement.role_name}</span>
                                    {assignment.person_id && (
                                      <span className="font-bold text-brand-teal">Linked profile</span>
                                    )}
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground/50 transition hover:bg-brand-teal/10 hover:text-brand-teal disabled:cursor-not-allowed disabled:opacity-30"
                                  onClick={() => openWhatsAppComposer(assignment)}
                                  disabled={!getTeamMemberForAssignment(assignment)?.phone_number}
                                  aria-label="Send WhatsApp message"
                                  title={
                                    getTeamMemberForAssignment(assignment)?.phone_number
                                      ? "Send WhatsApp message"
                                      : "No WhatsApp number"
                                  }
                                >
                                  <MessageCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                                </button>

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


      {whatsAppAssignment && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">WhatsApp Reminder</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Message {whatsAppAssignment.person_name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Review the message, then open WhatsApp to send it manually.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setWhatsAppAssignment(null);
                  setWhatsAppMessage("");
                }}
              >
                Close
              </Button>
            </div>

            <div className="mt-5 rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="label-eyebrow">Recipient</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
                  {whatsAppAssignment.person_name}
                </span>
                <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
                  {whatsAppAssignment.role_name}
                </span>
                {getTeamMemberForAssignment(whatsAppAssignment)?.phone_number && (
                  <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
                    {getTeamMemberForAssignment(whatsAppAssignment)?.phone_number}
                  </span>
                )}
              </div>
            </div>

            <div className="mt-5">
              <label className="label-eyebrow">Message</label>
              <textarea
                value={whatsAppMessage}
                onChange={(event) => setWhatsAppMessage(event.target.value)}
                rows={8}
                className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
              />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => {
                  setWhatsAppAssignment(null);
                  setWhatsAppMessage("");
                }}
              >
                Cancel
              </Button>

              <Button
                type="button"
                className="actsix-btn-primary rounded-xl"
                onClick={openWhatsAppLink}
                disabled={!whatsAppMessage.trim()}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Open WhatsApp
              </Button>
            </div>
          </Card>
        </div>
      )}

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

              {selectedTeamMemberId && (
                <div>
                  <label className="label-eyebrow">Linked People Profile</label>
                  <select
                    value={selectedAssignmentPersonId}
                    onChange={(event) => setSelectedAssignmentPersonId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    <option value="">No linked profile</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.display_name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Link this service assignment to a People profile. If selected, this team member will stay linked for future services.
                  </p>
                </div>
              )}

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

      <Card className="border-border/70 bg-card p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="label-eyebrow">Activity</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              Activity Log
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Recent changes made to this service plan.
            </p>
          </div>

          <History className="h-4 w-4 text-muted-foreground" />
        </div>

        {activityLogs.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
            No activity recorded yet.
          </div>
        )}

        {activityLogs.length > 0 && (
          <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70 bg-background">
            {activityLogs.map((activity) => (
              <div key={activity.id} className="flex gap-3 px-4 py-3">
                <PersonAvatar
                  name={activity.people?.display_name || "ACTSIX"}
                  avatarUrl={activity.people?.avatar_url}
                  size="sm"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-sm font-extrabold tracking-tight">
                      {activity.title}
                    </p>

                    <span className="text-xs text-muted-foreground">
                      {new Date(activity.created_at).toLocaleString()}
                    </span>
                  </div>

                  {activity.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {activity.description}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

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

              {selectedTeamMemberId && (
                <div>
                  <label className="label-eyebrow">Linked People Profile</label>
                  <select
                    value={selectedAssignmentPersonId}
                    onChange={(event) => setSelectedAssignmentPersonId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    <option value="">No linked profile</option>
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.display_name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Link this service assignment to a People profile. If selected, this team member will stay linked for future services.
                  </p>
                </div>
              )}

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
