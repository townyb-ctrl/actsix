import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Folder, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";

type Person = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  phone_number: string | null;
};

type PeopleGroupFolder = {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
};

type PeopleGroup = {
  id: string;
  user_id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
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

const PeopleGroups = () => {
  const { user } = useAuth();

  const [people, setPeople] = useState<Person[]>([]);
  const [folders, setFolders] = useState<PeopleGroupFolder[]>([]);
  const [groups, setGroups] = useState<PeopleGroup[]>([]);
  const [members, setMembers] = useState<PeopleGroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupFolderId, setNewGroupFolderId] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");

  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [memberRole, setMemberRole] = useState("");

  const load = async () => {
    if (!user) return;

    setLoading(true);

    const [
      { data: peopleData, error: peopleError },
      { data: folderData, error: folderError },
      { data: groupData, error: groupError },
      { data: memberData, error: memberError },
    ] = await Promise.all([
      (supabase as any)
        .from("people")
        .select("id, display_name, avatar_url, email, phone_number")
        .eq("user_id", user.id)
        .order("display_name", { ascending: true }),

      (supabase as any)
        .from("people_group_folders")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),

      (supabase as any)
        .from("people_groups")
        .select("*")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),

      (supabase as any)
        .from("people_group_members")
        .select("id, user_id, group_id, person_id, role, created_at, people(id, display_name, avatar_url, email, phone_number)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);

    if (peopleError) toast.error(peopleError.message);
    if (folderError) toast.error(folderError.message);
    if (groupError) toast.error(groupError.message);
    if (memberError) toast.error(memberError.message);

    setPeople(peopleData || []);
    setFolders(folderData || []);
    setGroups(groupData || []);
    setMembers(memberData || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [user]);

  const filteredGroups = useMemo(() => {
    if (selectedFolderId === "all") return groups;
    if (selectedFolderId === "uncategorized") {
      return groups.filter((group) => !group.folder_id);
    }

    return groups.filter((group) => group.folder_id === selectedFolderId);
  }, [groups, selectedFolderId]);

  const folderName = (folderId?: string | null) => {
    if (!folderId) return "Uncategorized";
    return folders.find((folderItem) => folderItem.id === folderId)?.name || "Folder";
  };

  const membersForGroup = (groupId: string) => {
    return members.filter((member) => member.group_id === groupId);
  };

  const availablePeopleForGroup = (groupId: string) => {
    const groupPersonIds = new Set(membersForGroup(groupId).map((member) => member.person_id));
    return people.filter((person) => !groupPersonIds.has(person.id));
  };

  const createFolder = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !newFolderName.trim()) return;

    const { error } = await (supabase as any)
      .from("people_group_folders")
      .insert({
        user_id: user.id,
        name: newFolderName.trim(),
      });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Folder created");
    setNewFolderName("");
    load();
  };

  const createGroup = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !newGroupName.trim()) return;

    const { error } = await (supabase as any)
      .from("people_groups")
      .insert({
        user_id: user.id,
        folder_id: newGroupFolderId || null,
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || null,
      });

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Group created");
    setNewGroupName("");
    setNewGroupFolderId("");
    setNewGroupDescription("");
    load();
  };

  const addMember = async (event: FormEvent) => {
    event.preventDefault();

    if (!user || !addMemberGroupId || selectedPersonIds.length === 0) return;

    const { error } = await (supabase as any)
      .from("people_group_members")
      .insert(
        selectedPersonIds.map((personId) => ({
          user_id: user.id,
          group_id: addMemberGroupId,
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
    setAddMemberGroupId(null);
    load();
  };

  const deleteMember = async (memberId: string) => {
    const { error } = await (supabase as any)
      .from("people_group_members")
      .delete()
      .eq("id", memberId)
      .eq("user_id", user?.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Person removed from group");
    load();
  };

  const deleteGroup = async (group: PeopleGroup) => {
    const confirmed = window.confirm(`Delete "${group.name}"? This will remove the group list, not the People profiles.`);
    if (!confirmed) return;

    const { error } = await (supabase as any)
      .from("people_groups")
      .delete()
      .eq("id", group.id)
      .eq("user_id", user?.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Group deleted");
    load();
  };

  const deleteFolder = async (folderItem: PeopleGroupFolder) => {
    const confirmed = window.confirm(`Delete folder "${folderItem.name}"? Groups inside it will become uncategorized.`);
    if (!confirmed) return;

    const { error } = await (supabase as any)
      .from("people_group_folders")
      .delete()
      .eq("id", folderItem.id)
      .eq("user_id", user?.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (selectedFolderId === folderItem.id) {
      setSelectedFolderId("all");
    }

    toast.success("Folder deleted");
    load();
  };

  const activeGroup = addMemberGroupId
    ? groups.find((group) => group.id === addMemberGroupId)
    : null;

  const availablePeople = addMemberGroupId
    ? availablePeopleForGroup(addMemberGroupId)
    : [];

  return (
    <div>
      <PageHeader
        eyebrow="ACTSIX: People"
        title="Groups"
        subtitle="Create folders and custom people lists for Bible studies, ministries, teams, training, and care rhythms."
      />

      <div className="px-8 pb-12 max-w-7xl space-y-6">
        <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
          <div className="space-y-4">
            <Card className="border-border/70 bg-card shadow-card p-5">
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-brand-teal" />
                <h2 className="font-extrabold tracking-tight">Folders</h2>
              </div>

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-bold transition ${
                    selectedFolderId === "all"
                      ? "bg-brand-teal/10 text-brand-teal"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setSelectedFolderId("all")}
                >
                  All Groups
                  <span>{groups.length}</span>
                </button>

                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-bold transition ${
                    selectedFolderId === "uncategorized"
                      ? "bg-brand-teal/10 text-brand-teal"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setSelectedFolderId("uncategorized")}
                >
                  Uncategorized
                  <span>{groups.filter((group) => !group.folder_id).length}</span>
                </button>

                {folders.map((folderItem) => (
                  <div key={folderItem.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      className={`flex min-w-0 flex-1 items-center justify-between rounded-xl px-3 py-2 text-sm font-bold transition ${
                        selectedFolderId === folderItem.id
                          ? "bg-brand-teal/10 text-brand-teal"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                      onClick={() => setSelectedFolderId(folderItem.id)}
                    >
                      <span className="truncate">{folderItem.name}</span>
                      <span>{groups.filter((group) => group.folder_id === folderItem.id).length}</span>
                    </button>

                    <button
                      type="button"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 hover:bg-muted hover:text-destructive"
                      onClick={() => deleteFolder(folderItem)}
                      aria-label="Delete folder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <form onSubmit={createFolder} className="mt-4 flex gap-2">
                <Input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  placeholder="New folder..."
                  className="border-border/70 bg-background"
                />
                <Button type="submit" size="icon" className="actsix-btn-primary rounded-xl shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </Card>

            <Card className="border-border/70 bg-card shadow-card p-5">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-brand-teal" />
                <h2 className="font-extrabold tracking-tight">Create Group</h2>
              </div>

              <form onSubmit={createGroup} className="mt-4 space-y-3">
                <div>
                  <label className="label-eyebrow">Group Name</label>
                  <Input
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    placeholder="Brandon’s Bible Study"
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <div>
                  <label className="label-eyebrow">Folder</label>
                  <select
                    value={newGroupFolderId}
                    onChange={(event) => setNewGroupFolderId(event.target.value)}
                    className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
                  >
                    <option value="">Uncategorized</option>
                    {folders.map((folderItem) => (
                      <option key={folderItem.id} value={folderItem.id}>
                        {folderItem.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label-eyebrow">Description</label>
                  <Input
                    value={newGroupDescription}
                    onChange={(event) => setNewGroupDescription(event.target.value)}
                    placeholder="Optional notes..."
                    className="mt-2 border-border/70 bg-background"
                  />
                </div>

                <Button
                  type="submit"
                  className="actsix-btn-primary w-full rounded-xl"
                  disabled={!newGroupName.trim()}
                >
                  <Plus className="h-4 w-4" />
                  Create Group
                </Button>
              </form>
            </Card>
          </div>

          <div className="space-y-4">
            {loading && (
              <Card className="border-border/70 bg-card shadow-card p-6">
                <p className="text-sm text-muted-foreground">Loading groups...</p>
              </Card>
            )}

            {!loading && filteredGroups.length === 0 && (
              <Card className="border-border/70 bg-card shadow-card p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-teal/10 text-brand-teal">
                  <Users className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-extrabold tracking-tight">
                  No groups here yet
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Create a group to start building custom people lists.
                </p>
              </Card>
            )}

            {!loading && filteredGroups.map((group) => {
              const groupMembers = membersForGroup(group.id);

              return (
                <Card key={group.id} className="border-border/70 bg-card shadow-card overflow-hidden">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 p-5">
                    <div>
                      <p className="label-eyebrow">{folderName(group.folder_id)}</p>
                      <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                        {group.name}
                      </h2>
                      {group.description && (
                        <p className="mt-1 text-sm text-muted-foreground">
                          {group.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => {
                          setAddMemberGroupId(group.id);
                          setSelectedPersonIds([]);
                          setMemberRole("");
                        }}
                      >
                        <UserPlus className="h-4 w-4" />
                        Add Person
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => deleteGroup(group)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="p-5">
                    {groupMembers.length === 0 && (
                      <div className="rounded-xl border border-dashed border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                        No people added to this group yet.
                      </div>
                    )}

                    {groupMembers.length > 0 && (
                      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border/70">
                        {groupMembers.map((member) => (
                          <div key={member.id} className="flex items-center gap-3 bg-background px-4 py-3">
                            <PersonAvatar
                              name={member.people?.display_name}
                              avatarUrl={member.people?.avatar_url}
                              size="md"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-extrabold tracking-tight">
                                {member.people?.display_name || "Person"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {member.role || member.people?.email || "Group member"}
                              </p>
                            </div>

                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/60 transition hover:bg-muted hover:text-destructive"
                              onClick={() => deleteMember(member.id)}
                              aria-label="Remove person from group"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      {addMemberGroupId && activeGroup && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-visible border-border/70 bg-card shadow-card">
            <form onSubmit={addMember} className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border/70 p-6">
                <div>
                  <p className="label-eyebrow">People Group</p>
                  <h2 className="text-xl font-extrabold tracking-tight">
                    Add Person to {activeGroup.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose People profiles and an optional role for this group.
                  </p>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setAddMemberGroupId(null);
                    setSelectedPersonIds([]);
                    setMemberRole("");
                  }}
                >
                  Close
                </Button>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-visible p-6">
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

                {availablePeople.length === 0 && (
                  <div className="rounded-xl border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
                    Everyone in People is already in this group.
                  </div>
                )}
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-border/70 bg-card p-6">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => {
                    setAddMemberGroupId(null);
                    setSelectedPersonIds([]);
                    setMemberRole("");
                  }}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  className="actsix-btn-primary rounded-xl"
                  disabled={selectedPersonIds.length === 0}
                >
                  <UserPlus className="h-4 w-4" />
                  {selectedPersonIds.length > 1 ? `Add ${selectedPersonIds.length} People` : "Add Person"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};

export default PeopleGroups;
