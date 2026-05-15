import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
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
    return teamMembers.filter((member) => member.team_id === selectedTeamId);
  }, [teamMembers, selectedTeamId]);

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

      setAssignedTeams(assignedTeamData || []);
      setTeamMembers(linkedMemberData || []);
    } else {
      setAssignedTeams([]);
      setTeamMembers([]);
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
          <Button asChild variant="outline" className="mt-4 rounded-xl">
            <Link to="/service-planner">
              Back to Services
            </Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <div className="px-8 pt-8 pb-12 max-w-7xl space-y-5">
        <Button asChild variant="ghost" className="rounded-xl text-muted-foreground">
          <Link to="/service-planner">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Services
          </Link>
        </Button>

        <div>
          <p className="label-eyebrow">ACTSIX: Service Planning</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            {service.title || serviceType?.name || "Service"}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              {formatDate(service.service_date)}
            </span>

            {service.start_time && (
              <span className="inline-flex items-center gap-2">
                <Clock3 className="h-4 w-4" />
                {service.start_time.slice(0, 5)}
              </span>
            )}

            {service.location && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                {service.location}
              </span>
            )}

            <span className="inline-flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
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

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl text-destructive"
                    onClick={() => deleteOrderItem(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-border/70 bg-card shadow-card overflow-hidden">
            <div className="border-b border-border p-4">
              <p className="label-eyebrow">Service Team</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Assign people
              </h2>
            </div>

            {assignedTeams.length === 0 && (
              <div className="border-b border-border p-4 text-sm text-muted-foreground">
                No teams assigned to this service type yet. Go to Services ? Manage Teams to assign teams first.
              </div>
            )}

            <form onSubmit={addTeamAssignment} className="space-y-3 border-b border-border p-4">
              <div>
                <label className="label-eyebrow">Team</label>
                <select
                  value={selectedTeamId}
                  onChange={(event) => {
                    setSelectedTeamId(event.target.value);
                    setSelectedTeamMemberId("");
                    setPersonName("");
                    setRoleName("");
                  }}
                  className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm"
                >
                  <option value="">Select team...</option>
                  {assignedTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-eyebrow">Person</label>
                <select
                  value={selectedTeamMemberId}
                  onChange={(event) => handleSelectTeamMember(event.target.value)}
                  disabled={!selectedTeamId}
                  className="mt-2 h-10 w-full rounded-md border border-border/70 bg-background px-3 text-sm disabled:opacity-60"
                >
                  <option value="">
                    {selectedTeamId ? "Select person..." : "Select a team first..."}
                  </option>
                  {selectedTeamMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.person_name}
                      {member.role_name ? ` ? ${member.role_name}` : ""}
                    </option>
                  ))}
                </select>
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
                <label className="label-eyebrow">Notes</label>
                <Input
                  value={teamNotes}
                  onChange={(event) => setTeamNotes(event.target.value)}
                  placeholder="Optional notes..."
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <Button type="submit" className="actsix-btn-primary rounded-xl w-full">
                <Plus className="h-4 w-4" />
                Add Team Member
              </Button>
            </form>

            <div className="divide-y divide-border">
              {teamAssignments.length === 0 && (
                <div className="p-6 text-sm text-muted-foreground">
                  No team members assigned yet.
                </div>
              )}

              {teamAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-center gap-3 p-4">
                  <div className="h-9 w-9 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-extrabold tracking-tight truncate">
                      {assignment.person_name}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {assignment.role_name}
                      {assignment.notes ? ` • ${assignment.notes}` : ""}
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl text-destructive"
                    onClick={() => deleteTeamAssignment(assignment)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

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
                  <Plus className="h-4 w-4" />
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
