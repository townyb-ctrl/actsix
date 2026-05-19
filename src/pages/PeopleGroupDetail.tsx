import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Edit3, Folder, MessageCircle, Save, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { getWhatsappHref, isMessageablePhone } from "@/lib/phone";

type Person = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  phone_number: string | null;
};

type PeopleGroup = {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  created_at: string;
  people_group_folders?: {
    name: string;
  } | null;
};

type PeopleGroupFolder = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

type PeopleGroupMember = {
  id: string;
  user_id: string;
  group_id: string;
  person_id: string;
  role: string | null;
  created_at: string;
  people?: Person | null;
};

const PeopleGroupDetail = () => {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [group, setGroup] = useState<PeopleGroup | null>(null);
  const [folders, setFolders] = useState<PeopleGroupFolder[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [members, setMembers] = useState<PeopleGroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDescription, setEditGroupDescription] = useState("");
  const [editGroupFolderId, setEditGroupFolderId] = useState("");

  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [memberRole, setMemberRole] = useState("");
  const [groupMessage, setGroupMessage] = useState("");

  const load = async () => {
    if (!user || !groupId) return;

    setLoading(true);

    const [
      { data: groupData, error: groupError },
      { data: folderData, error: folderError },
      { data: peopleData, error: peopleError },
      { data: memberData, error: memberError },
    ] = await Promise.all([
      (supabase as any)
        .from("people_groups")
        .select("id, user_id, folder_id, name, description, created_at, people_group_folders(name)")
        .eq("user_id", user.id)
        .eq("id", groupId)
        .maybeSingle(),

      (supabase as any)
        .from("people_group_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),

      (supabase as any)
        .from("people")
        .select("id, display_name, avatar_url, email, phone_number")
        .eq("user_id", user.id)
        .order("display_name", { ascending: true }),

      (supabase as any)
        .from("people_group_members")
        .select("id, user_id, group_id, person_id, role, created_at, people(id, display_name, avatar_url, email, phone_number)")
        .eq("user_id", user.id)
        .eq("group_id", groupId)
        .order("created_at", { ascending: true }),
    ]);

    if (groupError) toast.error(groupError.message);
    if (folderError) toast.error(folderError.message);
    if (peopleError) toast.error(peopleError.message);
    if (memberError) toast.error(memberError.message);

    setGroup(groupData || null);
    setFolders(folderData || []);
    setPeople(peopleData || []);
    setMembers(memberData || []);

    if (groupData) {
      setEditGroupName(groupData.name || "");
      setEditGroupDescription(groupData.description || "");
      setEditGroupFolderId(groupData.folder_id || "");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user, groupId]);

  const availablePeople = useMemo(() => {
    const memberPersonIds = new Set(members.map((member) => member.person_id));
    return people.filter((person) => !memberPersonIds.has(person.id));
  }, [people, members]);

  const messageableMembers = useMemo(() => {
    return members.filter((member) => isMessageablePhone(member.people?.phone_number));
  }, [members]);

  const nonMessageableMembers = useMemo(() => {
    return members.filter((member) => !isMessageablePhone(member.people?.phone_number));
  }, [members]);

  const messageGroupMembers = () => {
    if (messageableMembers.length === 0) {
      toast.error("No group members have valid phone numbers.");
      return;
    }

    const encodedMessage = groupMessage.trim()
      ? `?text=${encodeURIComponent(groupMessage.trim())}`
      : "";

    messageableMembers.forEach((member, index) => {
      const href = getWhatsappHref(member.people?.phone_number);

      if (!href) return;

      window.setTimeout(() => {
        window.open(`${href}${encodedMessage}`, "_blank", "noopener,noreferrer");
      }, index * 250);
    });

    toast.success(
      messageableMembers.length === 1
        ? "Opening WhatsApp message"
        : `Opening ${messageableMembers.length} WhatsApp messages`
    );
  };

  const addMembers = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !groupId || selectedPersonIds.length === 0) return;

    const { error } = await (supabase as any)
      .from("people_group_members")
      .insert(
        selectedPersonIds.map((personId) => ({
          user_id: user.id,
          group_id: groupId,
          person_id: personId,
          role: memberRole.trim() || null,
        }))
      );

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(
      selectedPersonIds.length === 1
        ? "Person added to group"
        : `${selectedPersonIds.length} people added to group`
    );

    setSelectedPersonIds([]);
    setMemberRole("");
    setAddPeopleOpen(false);
    load();
  };

  const updateGroup = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !groupId || !editGroupName.trim()) {
      toast.error("Group name is required.");
      return;
    }

    const { error } = await (supabase as any)
      .from("people_groups")
      .update({
        name: editGroupName.trim(),
        description: editGroupDescription.trim() || null,
        folder_id: editGroupFolderId || null,
      })
      .eq("id", groupId)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Group updated");
    setEditGroupOpen(false);
    load();
  };

  const removeMember = async (member: PeopleGroupMember) => {
    const confirmed = window.confirm(
      `Remove "${member.people?.display_name || "this person"}" from this group?`
    );

    if (!confirmed) return;

    const { error } = await (supabase as any)
      .from("people_group_members")
      .delete()
      .eq("id", member.id)
      .eq("user_id", user?.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Person removed from group");
    load();
  };

  if (loading) {
    return (
      <div className="px-8 py-12">
        <p className="text-sm text-muted-foreground">Loading group...</p>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="px-8 py-12">
        <Card className="border-border/70 bg-card p-6 shadow-card">
          <p className="text-sm text-muted-foreground">Group not found.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-4 rounded-xl"
            onClick={() => navigate("/people/groups")}
          >
            Back to Groups
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="px-8 pt-8 pb-12 max-w-7xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to="/people/groups"
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-brand-teal"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Groups
          </Link>

          <p className="label-eyebrow mt-6">ACTSIX: People Group</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
            {group.name}
          </h1>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 font-bold">
              <Folder className="h-3.5 w-3.5" />
              {group.people_group_folders?.name || "Uncategorized"}
            </span>

            <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-3 py-1 font-bold text-brand-teal">
              {members.length} {members.length === 1 ? "person" : "people"}
            </span>
          </div>

          {group.description && (
            <p className="mt-3 max-w-3xl text-sm text-muted-foreground">
              {group.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            onClick={() => {
              setEditGroupName(group.name || "");
              setEditGroupDescription(group.description || "");
              setEditGroupFolderId(group.folder_id || "");
              setEditGroupOpen(true);
            }}
          >
            <Edit3 className="h-4 w-4" />
            Edit Group
          </Button>

          <Button
            type="button"
            className="actsix-btn-primary rounded-xl"
            onClick={() => {
              setSelectedPersonIds([]);
              setMemberRole("");
              setAddPeopleOpen(true);
            }}
          >
            <UserPlus className="h-4 w-4" />
            Add People
          </Button>
        </div>
      </div>

      <Card className="border-border/70 bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="label-eyebrow">Messaging</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              Message group members
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Opens WhatsApp chats for members with valid phone numbers.
            </p>
          </div>

          <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-3 py-1 text-xs font-bold text-brand-teal">
            {messageableMembers.length} messageable
          </span>
        </div>

        <div className="mt-4">
          <label className="label-eyebrow">Message</label>
          <textarea
            value={groupMessage}
            onChange={(event) => setGroupMessage(event.target.value)}
            rows={3}
            placeholder={`Hi ${group.name} team...`}
            className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
          />
        </div>

        {nonMessageableMembers.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {nonMessageableMembers.length} member{nonMessageableMembers.length === 1 ? "" : "s"} will be skipped because they do not have a valid phone number.
          </p>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            type="button"
            className="actsix-btn-primary rounded-xl"
            onClick={messageGroupMembers}
            disabled={messageableMembers.length === 0}
          >
            <MessageCircle className="h-4 w-4" />
            Message Group
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden border-border/70 bg-card shadow-card">
        <div className="border-b border-border/70 px-5 py-4">
          <p className="label-eyebrow">Members</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">
            Group people
          </h2>
        </div>

        {members.length === 0 && (
          <div className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="mt-4 text-lg font-extrabold tracking-tight">
              No people added yet
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add people to start using this group.
            </p>
          </div>
        )}

        {members.length > 0 && (
          <div className="divide-y divide-border">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-3 px-5 py-4">
                <PersonAvatar
                  name={member.people?.display_name}
                  avatarUrl={member.people?.avatar_url}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  {member.people?.id ? (
                    <Link
                      to={`/people/${member.people.id}`}
                      className="truncate text-sm font-extrabold tracking-tight transition hover:text-brand-teal"
                    >
                      {member.people.display_name}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-extrabold tracking-tight">
                      Person
                    </p>
                  )}

                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    {member.role && <span>{member.role}</span>}
                    {member.people?.email && (
                      <>
                        {member.role && <span>·</span>}
                        <span>{member.people.email}</span>
                      </>
                    )}
                  </div>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeMember(member)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {editGroupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl border-border/70 bg-card p-6 shadow-card">
            <form onSubmit={updateGroup} className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="label-eyebrow">People Group</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Edit Group
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Update the group name, description, or folder.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setEditGroupOpen(false)}
                >
                  <X className="h-4 w-4" />
                  Close
                </Button>
              </div>

              <div>
                <label className="label-eyebrow">Group Name</label>
                <Input
                  value={editGroupName}
                  onChange={(event) => setEditGroupName(event.target.value)}
                  placeholder="Bible Study Group"
                  className="mt-2 border-border/70 bg-background"
                />
              </div>

              <div>
                <label className="label-eyebrow">Folder</label>
                <select
                  value={editGroupFolderId}
                  onChange={(event) => setEditGroupFolderId(event.target.value)}
                  className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                >
                  <option value="">Uncategorized</option>
                  {folders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-eyebrow">Description</label>
                <textarea
                  value={editGroupDescription}
                  onChange={(event) => setEditGroupDescription(event.target.value)}
                  rows={4}
                  placeholder="Optional notes about this group..."
                  className="mt-2 w-full rounded-xl border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setEditGroupOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  className="actsix-btn-primary rounded-xl"
                  disabled={!editGroupName.trim()}
                >
                  <Save className="h-4 w-4" />
                  Save Group
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {addPeopleOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl overflow-visible border-border/70 bg-card shadow-card">
            <form onSubmit={addMembers} className="flex flex-col">
              <div className="flex items-start justify-between gap-4 border-b border-border/70 p-6">
                <div>
                  <p className="label-eyebrow">People Group</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Add People to {group.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Select one or more People profiles to add to this group.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddPeopleOpen(false)}
                >
                  Close
                </Button>
              </div>

              <div className="space-y-4 p-6">
                <div>
                  <label className="label-eyebrow">People</label>
                  <div className="mt-2">
                    <PeopleMultiSearchSelect
                      people={availablePeople}
                      selectedPersonIds={selectedPersonIds}
                      onChange={setSelectedPersonIds}
                      placeholder="Search by name, email, or phone..."
                      emptyText="No available people found."
                    />
                  </div>
                </div>

                <div>
                  <label className="label-eyebrow">Role / Note</label>
                  <Input
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value)}
                    placeholder="Leader, member, host..."
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-border/70 bg-card p-6">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setAddPeopleOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  className="actsix-btn-primary rounded-xl"
                  disabled={selectedPersonIds.length === 0}
                >
                  <UserPlus className="h-4 w-4" />
                  {selectedPersonIds.length > 1
                    ? `Add ${selectedPersonIds.length} People`
                    : "Add Person"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PeopleGroupDetail;
