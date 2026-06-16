import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Crown, Edit3, Folder, MessageCircle, Save, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

const roleParts = (role: string | null) =>
  (role || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

const isLeaderRole = (role: string | null) =>
  roleParts(role).some((part) => part.toLowerCase().includes("leader"));

const getLeaderRole = (role: string | null, shouldBeLeader: boolean) => {
  const partsWithoutLeader = roleParts(role).filter(
    (part) => !part.toLowerCase().includes("leader")
  );

  if (!shouldBeLeader) return partsWithoutLeader.join(", ") || null;

  return ["Leader", ...partsWithoutLeader].join(", ");
};

const PeopleGroupDetailPage = () => {
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

  const load = async ({ showLoading = false } = {}) => {
    if (!user || !groupId) return;

    if (showLoading) {
      setLoading(true);
    }

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
    load({ showLoading: true });
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

  const updateMemberLeader = async (
    member: PeopleGroupMember,
    shouldBeLeader: boolean
  ) => {
    if (!user) return;

    const nextRole = getLeaderRole(member.role, shouldBeLeader);

    const { error } = await (supabase as any)
      .from("people_group_members")
      .update({ role: nextRole })
      .eq("id", member.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    setMembers((currentMembers) =>
      currentMembers.map((currentMember) =>
        currentMember.id === member.id
          ? { ...currentMember, role: nextRole }
          : currentMember
      )
    );

    toast.success(shouldBeLeader ? "Leader assigned" : "Leader removed");
  };

  if (loading) {
    return (
      <div className="px-4 py-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="actsix-panel p-4 sm:p-5">
          <div className="actsix-loading-state" role="status">Loading group...</div>
        </Card>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="px-4 py-12 sm:px-6 xl:px-8 2xl:px-10">
        <Card className="actsix-panel p-4 sm:p-5">
          <div className="actsix-empty-state">Group not found.</div>
          <Button
            type="button"
            variant="outline"
            className="actsix-btn-outline mt-4"
            onClick={() => navigate("/groups")}
          >
            Back to Groups
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="People Group"
        title={group.name}
        subtitle={group.description || "Manage members, leaders, and group messaging."}
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="actsix-btn-outline h-10"
              onClick={() => {
                setEditGroupName(group.name || "");
                setEditGroupDescription(group.description || "");
                setEditGroupFolderId(group.folder_id || "");
                setEditGroupOpen(true);
              }}
            >
              <Edit3 className="h-4 w-4" />
              Edit
            </Button>

            <Button
              type="button"
              className="actsix-btn-primary h-10"
              onClick={() => {
                setSelectedPersonIds([]);
                setMemberRole("");
                setAddPeopleOpen(true);
              }}
            >
              <UserPlus className="h-4 w-4" />
              Add People
            </Button>
          </>
        }
      />

      <div className="w-full space-y-5 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">
        <div className="actsix-panel-soft flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            to="/groups"
            className="inline-flex items-center gap-2 text-sm font-bold text-muted-foreground transition hover:text-brand-teal"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Groups
          </Link>

          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 font-bold">
              <Folder className="h-3.5 w-3.5" />
              {group.people_group_folders?.name || "Uncategorized"}
            </span>

            <span className="rounded-full border border-brand-teal bg-brand-teal/10 px-3 py-1 font-bold text-brand-teal">
              {members.length} {members.length === 1 ? "person" : "people"}
            </span>
          </div>
        </div>

        <Card className="actsix-panel p-5">
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
            className="mt-2 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
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
            className="actsix-btn-primary"
            onClick={messageGroupMembers}
            disabled={messageableMembers.length === 0}
          >
            <MessageCircle className="h-4 w-4" />
            Message Group
          </Button>
        </div>
        </Card>

        <Card className="actsix-panel overflow-hidden">
        <div className="border-b border-border/70 px-4 py-3">
          <p className="label-eyebrow">Members</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">
            Group people
          </h2>
        </div>

        {members.length === 0 && (
          <div className="actsix-empty-state m-3 min-h-[10rem] text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal">
              <Users className="h-5 w-5" />
            </div>
            <h2 className="mt-3 text-lg font-extrabold tracking-tight">
              No people added yet
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Add people to start using this group.
            </p>
          </div>
        )}

        {members.length > 0 && (
          <div className="divide-y divide-border/70">
            {members.map((member) => {
              const isLeader = isLeaderRole(member.role);

              return (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-3"
                >
                  <PersonAvatar
                    name={member.people?.display_name}
                    avatarUrl={member.people?.avatar_url}
                    size="md"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
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

                      {isLeader && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-brand-sage/15 px-2 py-0.5 text-[11px] font-bold text-brand-sage">
                          <Crown className="h-3 w-3" />
                          Leader
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {member.role && <span>{member.role}</span>}
                      {member.people?.email && (
                        <>
                          {member.role && <span>|</span>}
                          <span>{member.people.email}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="ml-auto flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant={isLeader ? "outline" : "ghost"}
                      size="sm"
                      className={
                        isLeader
                          ? "h-8 rounded-lg border-brand-sage/35 bg-brand-sage/10 px-2.5 text-xs font-bold text-brand-sage hover:bg-brand-sage/15 hover:text-brand-sage"
                          : "h-8 rounded-lg px-2.5 text-xs font-bold text-muted-foreground hover:text-brand-sage"
                      }
                      onClick={() => updateMemberLeader(member, !isLeader)}
                    >
                      <Crown className="h-3.5 w-3.5" />
                      {isLeader ? "Leader" : "Make Leader"}
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => removeMember(member)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </Card>
      </div>

      <Dialog open={editGroupOpen} onOpenChange={setEditGroupOpen}>
        <DialogContent className="max-w-xl">
            <form onSubmit={updateGroup} className="space-y-4">
              <DialogHeader>
                <p className="label-eyebrow">People Group</p>
                <DialogTitle className="text-xl">Edit Group</DialogTitle>
                <DialogDescription>
                  Update the group name, description, or folder.
                </DialogDescription>
              </DialogHeader>

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
                  className="mt-2 h-11 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
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
                  className="mt-2 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 py-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                />
              </div>

              <DialogFooter className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="actsix-btn-outline"
                  onClick={() => setEditGroupOpen(false)}
                >
                  Cancel
                </Button>

                <Button type="submit" className="actsix-btn-primary" disabled={!editGroupName.trim()}>
                  <Save className="h-4 w-4" />
                  Save Group
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addPeopleOpen} onOpenChange={setAddPeopleOpen}>
        <DialogContent className="max-w-2xl overflow-visible p-0">
            <form onSubmit={addMembers} className="flex flex-col">
              <div className="border-b border-border/70 p-4 sm:p-5">
                <DialogHeader className="text-left">
                  <p className="label-eyebrow">People Group</p>
                  <DialogTitle className="text-xl">Add People to {group.name}</DialogTitle>
                  <DialogDescription>
                    Select one or more People profiles to add to this group.
                  </DialogDescription>
                </DialogHeader>
              </div>

              <div className="space-y-4 p-4 sm:p-5">
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

              <DialogFooter className="flex justify-end gap-2 border-t border-border/70 bg-background/80 p-4 sm:p-5">
                <Button
                  type="button"
                  variant="outline"
                  className="actsix-btn-outline"
                  onClick={() => setAddPeopleOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  className="actsix-btn-primary"
                  disabled={selectedPersonIds.length === 0}
                >
                  <UserPlus className="h-4 w-4" />
                  {selectedPersonIds.length > 1
                    ? `Add ${selectedPersonIds.length} People`
                    : "Add Person"}
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PeopleGroupDetailPage;
