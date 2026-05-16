import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  Clock3,
  MapPin,
  MoreHorizontal,
  Plus,
  Settings,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type ServiceType = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  default_start_time: string | null;
  default_duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

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

type ServiceTeam = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
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

type TemplateItemDraft = {
  id?: string;
  item_type: string;
  title: string;
  details: string;
  duration_minutes: string;
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

const formatServiceTitleDate = (value: string) => {
  if (!value) return "";

  return new Date(value + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const ServicePlanner = () => {
  const { user } = useAuth();

  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [services, setServices] = useState<ServiceInstance[]>([]);
  const [teams, setTeams] = useState<ServiceTeam[]>([]);
  const [serviceTypeTeams, setServiceTypeTeams] = useState<ServiceTypeTeam[]>([]);
  const [teamLinkOpen, setTeamLinkOpen] = useState(false);
  const [teamLinkServiceType, setTeamLinkServiceType] = useState<ServiceType | null>(null);
  const [loading, setLoading] = useState(true);
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [addServiceOpen, setAddServiceOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [selectedServiceType, setSelectedServiceType] = useState<ServiceType | null>(null);
  const [templateServiceType, setTemplateServiceType] = useState<ServiceType | null>(null);
  const [template, setTemplate] = useState<ServiceOrderTemplate | null>(null);
  const [templateItems, setTemplateItems] = useState<TemplateItemDraft[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultStartTime, setDefaultStartTime] = useState("");
  const [defaultDuration, setDefaultDuration] = useState("75");

  const [serviceDate, setServiceDate] = useState("");
  const [serviceStartTime, setServiceStartTime] = useState("");
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceLocation, setServiceLocation] = useState("");

  const filteredServiceTypes = useMemo(() => {
    const q = search.trim().toLowerCase();

    return serviceTypes.filter((type) => {
      if (!q) return true;

      const servicesForType = services.filter((service) => service.service_type_id === type.id);

      const openTemplateEditor = async (serviceType: ServiceType) => {
    if (!user) return;

    setTemplateServiceType(serviceType);
    setTemplateOpen(true);
    setTemplateLoading(true);

    const { data: existingTemplate, error: templateError } = await supabase
      .from("service_order_templates")
      .select("*")
      .eq("user_id", user.id)
      .eq("service_type_id", serviceType.id)
      .maybeSingle();

    if (templateError) {
      toast.error(templateError.message);
      setTemplateLoading(false);
      return;
    }

    let activeTemplate = existingTemplate;

    if (!activeTemplate) {
      const { data: createdTemplate, error: createError } = await supabase
        .from("service_order_templates")
        .insert({
          user_id: user.id,
          service_type_id: serviceType.id,
          name: `${serviceType.name} Template`,
          description: null,
        })
        .select("*")
        .single();

      if (createError) {
        toast.error(createError.message);
        setTemplateLoading(false);
        return;
      }

      activeTemplate = createdTemplate;
    }

    setTemplate(activeTemplate);

    const { data: items, error: itemError } = await supabase
      .from("service_order_template_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("template_id", activeTemplate.id)
      .order("sort_order", { ascending: true });

    if (itemError) {
      toast.error(itemError.message);
      setTemplateLoading(false);
      return;
    }

    setTemplateItems(
      (items || []).map((item: ServiceOrderTemplateItem) => ({
        id: item.id,
        item_type: item.item_type,
        title: item.title,
        details: item.details || "",
        duration_minutes: String(item.duration_minutes || 5),
      }))
    );

    setTemplateLoading(false);
  };

  const addTemplateItem = () => {
    setTemplateItems((previous) => [
      ...previous,
      {
        item_type: "General",
        title: "",
        details: "",
        duration_minutes: "5",
      },
    ]);
  };

  const updateTemplateItem = (
    index: number,
    field: keyof TemplateItemDraft,
    value: string
  ) => {
    setTemplateItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeTemplateItem = (index: number) => {
    setTemplateItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveTemplateItems = async () => {
    if (!user || !template) return;

    const cleanedItems = templateItems
      .map((item, index) => ({
        user_id: user.id,
        template_id: template.id,
        item_type: item.item_type || "General",
        title: item.title.trim(),
        details: item.details.trim() || null,
        duration_minutes: Number(item.duration_minutes) || 5,
        sort_order: index,
      }))
      .filter((item) => item.title);

    const { error: deleteError } = await supabase
      .from("service_order_template_items")
      .delete()
      .eq("template_id", template.id)
      .eq("user_id", user.id);

    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }

    if (cleanedItems.length) {
      const { error: insertError } = await supabase
        .from("service_order_template_items")
        .insert(cleanedItems);

      if (insertError) {
        toast.error(insertError.message);
        return;
      }
    }

    toast.success("Service template saved");
    setTemplateOpen(false);
    setTemplateServiceType(null);
    setTemplate(null);
    setTemplateItems([]);
  };

  const getTeamsForServiceType = (serviceTypeId: string) => {
    const linkedTeamIds = serviceTypeTeams
      .filter((link) => link.service_type_id === serviceTypeId)
      .map((link) => link.team_id);

    return teams.filter((team) => linkedTeamIds.includes(team.id));
  };

  const openTeamLinkEditor = (serviceType: ServiceType) => {
    setTeamLinkServiceType(serviceType);
    setTeamLinkOpen(true);
  };

  const toggleServiceTypeTeam = async (team: ServiceTeam) => {
    if (!user || !teamLinkServiceType) return;

    const existingLink = serviceTypeTeams.find(
      (link) =>
        link.service_type_id === teamLinkServiceType.id &&
        link.team_id === team.id
    );

    if (existingLink) {
      const { error } = await supabase
        .from("service_type_teams")
        .delete()
        .eq("id", existingLink.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(`${team.name} removed from ${teamLinkServiceType.name}`);
      fetchData();
      return;
    }

    const { error } = await supabase.from("service_type_teams").insert({
      user_id: user.id,
      service_type_id: teamLinkServiceType.id,
      team_id: team.id,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${team.name} assigned to ${teamLinkServiceType.name}`);
    fetchData();
  };

  return (
        type.name.toLowerCase().includes(q) ||
        (type.description || "").toLowerCase().includes(q) ||
        servicesForType.some((service) =>
          [
            service.title || "",
            service.service_date || "",
            service.location || "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      );
    });
  }, [serviceTypes, services, search]);

  const fetchData = async () => {
    if (!user) return;

    setLoading(true);

    const [{ data: typeData, error: typeError }, { data: serviceData, error: serviceError }] =
      await Promise.all([
        supabase
          .from("service_types")
          .select("*")
          .eq("user_id", user.id)
          .order("default_start_time", { ascending: true })
          .order("name", { ascending: true }),

        supabase
          .from("service_instances")
          .select("*")
          .eq("user_id", user.id)
          .order("service_date", { ascending: true })
          .order("start_time", { ascending: true }),
      ]);

    if (typeError) {
      toast.error(typeError.message);
      setLoading(false);
      return;
    }

    if (serviceError) {
      toast.error(serviceError.message);
      setLoading(false);
      return;
    }

    const [{ data: teamData, error: teamError }, { data: serviceTypeTeamData, error: serviceTypeTeamError }] =
      await Promise.all([
        supabase
          .from("service_teams")
          .select("*")
          .eq("user_id", user.id)
          .order("name", { ascending: true }),

        supabase
          .from("service_type_teams")
          .select("*")
          .eq("user_id", user.id),
      ]);

    if (teamError) {
      toast.error(teamError.message);
      setLoading(false);
      return;
    }

    if (serviceTypeTeamError) {
      toast.error(serviceTypeTeamError.message);
      setLoading(false);
      return;
    }

    setServiceTypes(typeData || []);
    setServices(serviceData || []);
    setTeams(teamData || []);
    setServiceTypeTeams(serviceTypeTeamData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const resetTypeForm = () => {
    setName("");
    setDescription("");
    setDefaultStartTime("");
    setDefaultDuration("75");
  };

  const resetServiceForm = () => {
    setServiceDate("");
    setServiceStartTime("");
    setServiceTitle("");
    setServiceLocation("");
  };

  const createServiceType = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      toast.error("You need to be signed in.");
      return;
    }

    if (!name.trim()) {
      toast.error("Service type name is required.");
      return;
    }

    const { error } = await supabase.from("service_types").insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim() || null,
      default_start_time: defaultStartTime || null,
      default_duration_minutes: Number(defaultDuration) || 75,
      is_active: true,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Service type created");
    resetTypeForm();
    setAddTypeOpen(false);
    fetchData();
  };

  const openAddService = (serviceType: ServiceType) => {
    setSelectedServiceType(serviceType);
    setServiceTitle(serviceType.name);
    setServiceStartTime(serviceType.default_start_time?.slice(0, 5) || "");
    setServiceLocation("");
    setServiceDate("");
    setAddServiceOpen(true);
  };

  const createServiceInstance = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user || !selectedServiceType) {
      toast.error("Service type not selected.");
      return;
    }

    if (!serviceDate) {
      toast.error("Service date is required.");
      return;
    }

    const { error } = await supabase.from("service_instances").insert({
      user_id: user.id,
      service_type_id: selectedServiceType.id,
      title: formatServiceTitleDate(serviceDate),
      service_date: serviceDate,
      start_time: serviceStartTime || selectedServiceType.default_start_time || null,
      location: serviceLocation.trim() || null,
      notes: null,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Service date created");
    resetServiceForm();
    setSelectedServiceType(null);
    setAddServiceOpen(false);
    fetchData();
  };

  const deleteServiceType = async (serviceType: ServiceType) => {
    const confirmed = window.confirm(
      `Delete "${serviceType.name}"? This will also delete service dates inside this service type.`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("service_types")
      .delete()
      .eq("id", serviceType.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Service type deleted");
    fetchData();
  };

  const deleteServiceInstance = async (service: ServiceInstance) => {
    const confirmed = window.confirm(
      `Delete "${service.title || "Service"}" on ${formatDate(service.service_date)}?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from("service_instances")
      .delete()
      .eq("id", service.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Service deleted");
    fetchData();
  };

  const openTemplateEditor = async (serviceType: ServiceType) => {
    if (!user) return;

    setTemplateServiceType(serviceType);
    setTemplateOpen(true);
    setTemplateLoading(true);

    const { data: existingTemplate, error: templateError } = await supabase
      .from("service_order_templates")
      .select("*")
      .eq("user_id", user.id)
      .eq("service_type_id", serviceType.id)
      .maybeSingle();

    if (templateError) {
      toast.error(templateError.message);
      setTemplateLoading(false);
      return;
    }

    let activeTemplate = existingTemplate;

    if (!activeTemplate) {
      const { data: createdTemplate, error: createError } = await supabase
        .from("service_order_templates")
        .insert({
          user_id: user.id,
          service_type_id: serviceType.id,
          name: `${serviceType.name} Template`,
          description: null,
        })
        .select("*")
        .single();

      if (createError) {
        toast.error(createError.message);
        setTemplateLoading(false);
        return;
      }

      activeTemplate = createdTemplate;
    }

    setTemplate(activeTemplate);

    const { data: items, error: itemError } = await supabase
      .from("service_order_template_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("template_id", activeTemplate.id)
      .order("sort_order", { ascending: true });

    if (itemError) {
      toast.error(itemError.message);
      setTemplateLoading(false);
      return;
    }

    setTemplateItems(
      (items || []).map((item: ServiceOrderTemplateItem) => ({
        id: item.id,
        item_type: item.item_type,
        title: item.title,
        details: item.details || "",
        duration_minutes: String(item.duration_minutes || 5),
      }))
    );

    setTemplateLoading(false);
  };

  const addTemplateItem = () => {
    setTemplateItems((previous) => [
      ...previous,
      {
        item_type: "General",
        title: "",
        details: "",
        duration_minutes: "5",
      },
    ]);
  };

  const updateTemplateItem = (
    index: number,
    field: keyof TemplateItemDraft,
    value: string
  ) => {
    setTemplateItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeTemplateItem = (index: number) => {
    setTemplateItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveTemplateItems = async () => {
    if (!user || !template) return;

    const cleanedItems = templateItems
      .map((item, index) => ({
        user_id: user.id,
        template_id: template.id,
        item_type: item.item_type || "General",
        title: item.title.trim(),
        details: item.details.trim() || null,
        duration_minutes: Number(item.duration_minutes) || 5,
        sort_order: index,
      }))
      .filter((item) => item.title);

    const { error: deleteError } = await supabase
      .from("service_order_template_items")
      .delete()
      .eq("template_id", template.id)
      .eq("user_id", user.id);

    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }

    if (cleanedItems.length) {
      const { error: insertError } = await supabase
        .from("service_order_template_items")
        .insert(cleanedItems);

      if (insertError) {
        toast.error(insertError.message);
        return;
      }
    }

    toast.success("Service template saved");
    setTemplateOpen(false);
    setTemplateServiceType(null);
    setTemplate(null);
    setTemplateItems([]);
  };

  const getTeamsForServiceType = (serviceTypeId: string) => {
    const linkedTeamIds = serviceTypeTeams
      .filter((link) => link.service_type_id === serviceTypeId)
      .map((link) => link.team_id);

    return teams.filter((team) => linkedTeamIds.includes(team.id));
  };

  const openTeamLinkEditor = (serviceType: ServiceType) => {
    setTeamLinkServiceType(serviceType);
    setTeamLinkOpen(true);
  };

  const toggleServiceTypeTeam = async (team: ServiceTeam) => {
    if (!user || !teamLinkServiceType) return;

    const existingLink = serviceTypeTeams.find(
      (link) =>
        link.service_type_id === teamLinkServiceType.id &&
        link.team_id === team.id
    );

    if (existingLink) {
      const { error } = await supabase
        .from("service_type_teams")
        .delete()
        .eq("id", existingLink.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(`${team.name} removed from ${teamLinkServiceType.name}`);
      fetchData();
      return;
    }

    const { error } = await supabase.from("service_type_teams").insert({
      user_id: user.id,
      service_type_id: teamLinkServiceType.id,
      team_id: team.id,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${team.name} assigned to ${teamLinkServiceType.name}`);
    fetchData();
  };

  return (
    <div>
      <div className="px-8 pt-4 pb-12 max-w-7xl space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label-eyebrow">ACTSIX: Service Planning</p>
            <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
              Services
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              Create service types, add service dates, and open each service to build the order and serving team.
            </p>
          </div>

          <Button
            type="button"
            className="actsix-btn-primary rounded-xl shrink-0"
            onClick={() => setAddTypeOpen(true)}
          >
            <Plus className="h-6 w-6" strokeWidth={3} />
            Add Service Type
          </Button>
        </div>

        <div className="space-y-5">
          {loading && (
            <Card className="p-6 border-border/70 bg-card shadow-card">
              <p className="text-sm text-muted-foreground">Loading services...</p>
            </Card>
          )}

          {!loading && filteredServiceTypes.length === 0 && (
            <Card className="p-6 border-border/70 bg-card shadow-card">
              <p className="text-sm text-muted-foreground">
                No service types found. Add your first service type to begin.
              </p>
            </Card>
          )}

          {!loading &&
            filteredServiceTypes.map((type) => {
              const servicesForType = services.filter(
                (service) => service.service_type_id === type.id
              );

              const openTemplateEditor = async (serviceType: ServiceType) => {
    if (!user) return;

    setTemplateServiceType(serviceType);
    setTemplateOpen(true);
    setTemplateLoading(true);

    const { data: existingTemplate, error: templateError } = await supabase
      .from("service_order_templates")
      .select("*")
      .eq("user_id", user.id)
      .eq("service_type_id", serviceType.id)
      .maybeSingle();

    if (templateError) {
      toast.error(templateError.message);
      setTemplateLoading(false);
      return;
    }

    let activeTemplate = existingTemplate;

    if (!activeTemplate) {
      const { data: createdTemplate, error: createError } = await supabase
        .from("service_order_templates")
        .insert({
          user_id: user.id,
          service_type_id: serviceType.id,
          name: `${serviceType.name} Template`,
          description: null,
        })
        .select("*")
        .single();

      if (createError) {
        toast.error(createError.message);
        setTemplateLoading(false);
        return;
      }

      activeTemplate = createdTemplate;
    }

    setTemplate(activeTemplate);

    const { data: items, error: itemError } = await supabase
      .from("service_order_template_items")
      .select("*")
      .eq("user_id", user.id)
      .eq("template_id", activeTemplate.id)
      .order("sort_order", { ascending: true });

    if (itemError) {
      toast.error(itemError.message);
      setTemplateLoading(false);
      return;
    }

    setTemplateItems(
      (items || []).map((item: ServiceOrderTemplateItem) => ({
        id: item.id,
        item_type: item.item_type,
        title: item.title,
        details: item.details || "",
        duration_minutes: String(item.duration_minutes || 5),
      }))
    );

    setTemplateLoading(false);
  };

  const addTemplateItem = () => {
    setTemplateItems((previous) => [
      ...previous,
      {
        item_type: "General",
        title: "",
        details: "",
        duration_minutes: "5",
      },
    ]);
  };

  const updateTemplateItem = (
    index: number,
    field: keyof TemplateItemDraft,
    value: string
  ) => {
    setTemplateItems((previous) =>
      previous.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeTemplateItem = (index: number) => {
    setTemplateItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  };

  const saveTemplateItems = async () => {
    if (!user || !template) return;

    const cleanedItems = templateItems
      .map((item, index) => ({
        user_id: user.id,
        template_id: template.id,
        item_type: item.item_type || "General",
        title: item.title.trim(),
        details: item.details.trim() || null,
        duration_minutes: Number(item.duration_minutes) || 5,
        sort_order: index,
      }))
      .filter((item) => item.title);

    const { error: deleteError } = await supabase
      .from("service_order_template_items")
      .delete()
      .eq("template_id", template.id)
      .eq("user_id", user.id);

    if (deleteError) {
      toast.error(deleteError.message);
      return;
    }

    if (cleanedItems.length) {
      const { error: insertError } = await supabase
        .from("service_order_template_items")
        .insert(cleanedItems);

      if (insertError) {
        toast.error(insertError.message);
        return;
      }
    }

    toast.success("Service template saved");
    setTemplateOpen(false);
    setTemplateServiceType(null);
    setTemplate(null);
    setTemplateItems([]);
  };

  const getTeamsForServiceType = (serviceTypeId: string) => {
    const linkedTeamIds = serviceTypeTeams
      .filter((link) => link.service_type_id === serviceTypeId)
      .map((link) => link.team_id);

    return teams.filter((team) => linkedTeamIds.includes(team.id));
  };

  const openTeamLinkEditor = (serviceType: ServiceType) => {
    setTeamLinkServiceType(serviceType);
    setTeamLinkOpen(true);
  };

  const toggleServiceTypeTeam = async (team: ServiceTeam) => {
    if (!user || !teamLinkServiceType) return;

    const existingLink = serviceTypeTeams.find(
      (link) =>
        link.service_type_id === teamLinkServiceType.id &&
        link.team_id === team.id
    );

    if (existingLink) {
      const { error } = await supabase
        .from("service_type_teams")
        .delete()
        .eq("id", existingLink.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success(`${team.name} removed from ${teamLinkServiceType.name}`);
      fetchData();
      return;
    }

    const { error } = await supabase.from("service_type_teams").insert({
      user_id: user.id,
      service_type_id: teamLinkServiceType.id,
      team_id: team.id,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`${team.name} assigned to ${teamLinkServiceType.name}`);
    fetchData();
  };

  return (
                <Card
                  key={type.id}
                  className="border-border/70 bg-card shadow-card overflow-hidden"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-teal/20 bg-brand-teal px-4 py-3 text-white">
                    <div className="min-w-0">
                      <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-white/65">
                        Service Type
                      </p>
                      <h2 className="mt-0.5 text-2xl font-extrabold tracking-tight text-white">
                        {type.name}
                      </h2>

                      {type.description && (
                        <p className="mt-1 text-xs text-white/75">
                          {type.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent p-0 text-white shadow-none transition hover:bg-white/10 hover:text-white"
                        onClick={() => openAddService(type)}
                        aria-label="Add service date"
                      >
                        <Plus className="h-5 w-5" strokeWidth={2.6} />
                      </button>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-md border-0 bg-transparent p-0 text-white shadow-none transition hover:bg-white/10 hover:text-white"
                          aria-label="Service type options"
                        >
                          <MoreHorizontal className="h-5 w-5" strokeWidth={2.6} />
                        </button>
                      </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => openTeamLinkEditor(type)}>
                            <Users className="mr-2 h-4 w-4" />
                            Manage Teams
                          </DropdownMenuItem>

                          <DropdownMenuItem onClick={() => openTemplateEditor(type)}>
                            <Settings className="mr-2 h-4 w-4" />
                            Edit Template
                          </DropdownMenuItem>

                          <DropdownMenuSeparator />

                          <DropdownMenuItem
                            onClick={() => deleteServiceType(type)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Service Type
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="divide-y divide-border">
                    {servicesForType.length === 0 && (
                      <div className="p-4 text-sm text-muted-foreground">
                        No service dates created yet.
                      </div>
                    )}

                    {servicesForType.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors"
                      >
                        <div className="h-10 w-10 rounded-lg bg-brand-teal/10 text-brand-teal flex items-center justify-center shrink-0">
                          <CalendarDays className="h-5 w-5" />
                        </div>

                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/service-planner/services/${service.id}`}
                            className="font-extrabold tracking-tight truncate hover:text-brand-teal transition-colors"
                          >
                            {formatServiceTitleDate(service.service_date)}
                          </Link>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <CalendarDays className="h-3.5 w-3.5" />
                              {formatDate(service.service_date)}
                            </span>

                            {service.start_time && (
                              <span className="inline-flex items-center gap-1">
                                <Clock3 className="h-3.5 w-3.5" />
                                {service.start_time.slice(0, 5)}
                              </span>
                            )}

                            {service.location && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {service.location}
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          type="button"
                          variant="outline"
                          className="rounded-xl text-destructive"
                          onClick={() => deleteServiceInstance(service)}
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

      {addTypeOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Service Type</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Add Service Type
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create patterns like 8AM Service, 10AM Service, Evening Service, or Special Service.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setAddTypeOpen(false)}
              >
                Close
              </Button>
            </div>

            <form onSubmit={createServiceType} className="mt-6 space-y-4">
              <div>
                <label className="label-eyebrow">Service Name</label>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="8AM Service"
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Description</label>
                <Input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Early morning worship service"
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">Default Start Time</label>
                  <Input
                    type="time"
                    value={defaultStartTime}
                    onChange={(event) => setDefaultStartTime(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Default Duration</label>
                  <Input
                    type="number"
                    min="15"
                    value={defaultDuration}
                    onChange={(event) => setDefaultDuration(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddTypeOpen(false)}
                >
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary rounded-xl">
                  <Plus className="h-4 w-4" />
                  Create Service Type
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {addServiceOpen && selectedServiceType && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Service Date</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Add {selectedServiceType.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a specific service date that can have its own order and team.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setAddServiceOpen(false)}
              >
                Close
              </Button>
            </div>

            <form onSubmit={createServiceInstance} className="mt-6 space-y-4">
              <div>
                <label className="label-eyebrow">Service Title</label>
                <Input
                  value={serviceTitle}
                  onChange={(event) => setServiceTitle(event.target.value)}
                  placeholder={selectedServiceType.name}
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="label-eyebrow">Service Date</label>
                  <Input
                    type="date"
                    value={serviceDate}
                    onChange={(event) => setServiceDate(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Start Time</label>
                  <Input
                    type="time"
                    value={serviceStartTime}
                    onChange={(event) => setServiceStartTime(event.target.value)}
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="label-eyebrow">Location</label>
                <Input
                  value={serviceLocation}
                  onChange={(event) => setServiceLocation(event.target.value)}
                  placeholder="Sanctuary"
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddServiceOpen(false)}
                >
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary rounded-xl">
                  <Plus className="h-4 w-4" />
                  Create Service
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {templateOpen && templateServiceType && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-5xl max-h-[86vh] overflow-auto border-border/70 bg-card shadow-card p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Service Template</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  Edit Service Template
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Set the normal order of service for {templateServiceType.name}. This can be applied to individual service dates.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setTemplateOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="mt-6 space-y-3">
              {templateLoading ? (
                <p className="text-sm text-muted-foreground">Loading template...</p>
              ) : (
                <>
                  {templateItems.length === 0 && (
                    <div className="rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                      No template items yet. Add your standard welcome, songs, sermon, notices, and other recurring service elements.
                    </div>
                  )}

                  {templateItems.map((item, index) => (
                    <div
                      key={`${item.id || "new"}-${index}`}
                      className="grid gap-2 rounded-xl border border-border/70 bg-background p-3 md:grid-cols-[140px_minmax(0,1fr)_100px_auto]"
                    >
                      <select
                        value={item.item_type}
                        onChange={(event) => updateTemplateItem(index, "item_type", event.target.value)}
                        className="h-10 rounded-md border border-border/70 bg-card px-3 text-sm"
                      >
                        <option>Song</option>
                        <option>Welcome</option>
                        <option>Announcements</option>
                        <option>Prayer</option>
                        <option>Offering</option>
                        <option>Sermon</option>
                        <option>Communion</option>
                        <option>Benediction</option>
                        <option>General</option>
                      </select>

                      <Input
                        value={item.title}
                        onChange={(event) => updateTemplateItem(index, "title", event.target.value)}
                        placeholder="Template item title..."
                        className="border-border/70 bg-card"
                      />

                      <Input
                        type="number"
                        min="1"
                        value={item.duration_minutes}
                        onChange={(event) => updateTemplateItem(index, "duration_minutes", event.target.value)}
                        className="border-border/70 bg-card"
                      />

                      <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl text-destructive"
                        onClick={() => removeTemplateItem(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <Input
                        value={item.details}
                        onChange={(event) => updateTemplateItem(index, "details", event.target.value)}
                        placeholder="Optional details, key, scripture, or notes..."
                        className="border-border/70 bg-card md:col-span-4"
                      />
                    </div>
                  ))}
                </>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={addTemplateItem}
              >
                <Plus className="h-4 w-4" />
                Add Template Item
              </Button>

              <Button
                type="button"
                className="actsix-btn-primary rounded-xl"
                onClick={saveTemplateItems}
                disabled={templateLoading}
              >
                Save Template
              </Button>
            </div>
          </Card>
        </div>
      )}


      {teamLinkOpen && teamLinkServiceType && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-2xl border-border/70 bg-card shadow-card p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="label-eyebrow">Assign Teams to Service Type</p>
                <h2 className="text-xl font-extrabold tracking-tight">
                  {teamLinkServiceType.name}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Select the teams that normally serve in this service type.
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => setTeamLinkOpen(false)}
              >
                Close
              </Button>
            </div>

            <div className="mt-6 space-y-2">
              {teams.length === 0 && (
                <div className="rounded-xl border border-border/70 bg-background p-4 text-sm text-muted-foreground">
                  No teams created yet. Create teams from Service Planning ? Teams first.
                </div>
              )}

              {teams.map((team) => {
                const linked = serviceTypeTeams.some(
                  (link) =>
                    link.service_type_id === teamLinkServiceType.id &&
                    link.team_id === team.id
                );

                return (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => toggleServiceTypeTeam(team)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      linked
                        ? "border-brand-teal bg-brand-teal/10"
                        : "border-border/70 bg-background hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-extrabold tracking-tight">
                          {team.name}
                        </div>
                        {team.description && (
                          <p className="mt-1 text-sm text-muted-foreground">
                            {team.description}
                          </p>
                        )}
                      </div>

                      <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-bold text-muted-foreground">
                        {linked ? "Assigned" : "Not assigned"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}

    </div>
  );
};

export default ServicePlanner;
