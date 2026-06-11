import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Edit3, Folder, Plus, Save, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PersonAvatar } from "@/components/people/PersonAvatar";
import { PageHeader } from "@/components/PageHeader";

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

const PeopleGroupsPage = () => {
  const { user } = useAuth();

  const [folders, setFolders] = useState<PeopleGroupFolder[]>([]);
  const [groups, setGroups] = useState<PeopleGroup[]>([]);
  const [members, setMembers] = useState<PeopleGroupMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedFolderId, setSelectedFolderId] = useState("all");
  const [newFolderName, setNewFolderName] = useState("");
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupFolderId, setNewGroupFolderId] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [createGroupOpen, setCreateGroupOpen] = useState(false);

  const load = async () => {
    if (!user) return;

    setLoading(true);

    const [
      { data: folderData, error: folderError },
      { data: groupData, error: groupError },
      { data: memberData, error: memberError },
    ] = await Promise.all([
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

    if (folderError) toast.error(folderError.message);
    if (groupError) toast.error(groupError.message);
    if (memberError) toast.error(memberError.message);

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

  const startEditingFolder = (folderItem: PeopleGroupFolder) => {
    setEditingFolderId(folderItem.id);
    setEditingFolderName(folderItem.name);
  };

  const cancelEditingFolder = () => {
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  const updateFolder = async (event?: FormEvent) => {
    event?.preventDefault();

    if (!user || !editingFolderId || !editingFolderName.trim()) return;

    const { error } = await (supabase as any)
      .from("people_group_folders")
      .update({
        name: editingFolderName.trim(),
      })
      .eq("id", editingFolderId)
      .eq("user_id", user.id);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Folder renamed");
    cancelEditingFolder();
    load();
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
    setCreateGroupOpen(false);
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

  return (
    <div>
      <PageHeader
        eyebrow="People"
        title="Groups"
        subtitle="Build custom people lists for Bible studies, ministries, teams, training, and care rhythms."
        actions={
          <Button
            type="button"
            size="sm"
            className="actsix-btn-primary shrink-0"
            onClick={() => setCreateGroupOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Create Group
          </Button>
        }
      />

      <div className="w-full space-y-4 px-4 pb-12 sm:px-6 xl:px-8 2xl:px-10">

        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <Card className="actsix-panel-soft overflow-hidden">
              <div className="border-b border-border/70 bg-brand-sage-soft px-4 py-3">
                <div className="flex items-center gap-2">
                  <Folder className="h-4 w-4 text-brand-sage" />
                  <h2 className="font-extrabold tracking-tight">Folders</h2>
                </div>
              </div>

              <div className="space-y-1 p-2">
                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-[var(--radius-control)] px-3 py-2 text-sm font-bold transition ${
                    selectedFolderId === "all"
                      ? "bg-brand-sage/10 text-brand-sage"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setSelectedFolderId("all")}
                >
                  All Groups
                  <span>{groups.length}</span>
                </button>

                <button
                  type="button"
                  className={`flex w-full items-center justify-between rounded-[var(--radius-control)] px-3 py-2 text-sm font-bold transition ${
                    selectedFolderId === "uncategorized"
                      ? "bg-brand-sage/10 text-brand-sage"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                  onClick={() => setSelectedFolderId("uncategorized")}
                >
                  Uncategorized
                  <span>{groups.filter((group) => !group.folder_id).length}</span>
                </button>

                {folders.map((folderItem) => {
                  const isEditingFolder = editingFolderId === folderItem.id;

                  return (
                    <div key={folderItem.id} className="flex items-center gap-1">
                      {isEditingFolder ? (
                        <form onSubmit={updateFolder} className="flex min-w-0 flex-1 items-center gap-1">
                          <Input
                            value={editingFolderName}
                            onChange={(event) => setEditingFolderName(event.target.value)}
                            className="h-8 rounded-[var(--radius-control)] border-border/70 bg-background text-sm"
                            autoFocus
                          />

                          <button
                            type="submit"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-brand-teal hover:bg-brand-teal/10"
                            aria-label="Save folder name"
                            disabled={!editingFolderName.trim()}
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground hover:bg-muted"
                            onClick={cancelEditingFolder}
                            aria-label="Cancel rename"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`flex min-w-0 flex-1 items-center justify-between rounded-[var(--radius-control)] px-3 py-2 text-sm font-bold transition ${
                              selectedFolderId === folderItem.id
                                ? "bg-brand-sage/10 text-brand-sage"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                            onClick={() => setSelectedFolderId(folderItem.id)}
                          >
                            <span className="truncate">{folderItem.name}</span>
                            <span>{groups.filter((group) => group.folder_id === folderItem.id).length}</span>
                          </button>

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground/60 hover:bg-muted hover:text-brand-teal"
                            onClick={() => startEditingFolder(folderItem)}
                            aria-label="Rename folder"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground/60 hover:bg-muted hover:text-destructive"
                            onClick={() => deleteFolder(folderItem)}
                            aria-label="Delete folder"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <form onSubmit={createFolder} className="flex gap-2 border-t border-border/70 p-3">
                <Input
                  value={newFolderName}
                  onChange={(event) => setNewFolderName(event.target.value)}
                  placeholder="New folder..."
                  className="h-9 rounded-[var(--radius-control)] border-border/70 bg-background"
                />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0 rounded-[var(--radius-control)] bg-brand-sage text-white hover:bg-brand-sage/90">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </Card>

          </aside>

          <div>
            {loading && (
              <Card className="actsix-panel p-5">
                <div className="actsix-loading-state" role="status">Loading groups...</div>
              </Card>
            )}

            {!loading && filteredGroups.length === 0 && (
              <Card className="actsix-panel p-8 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-brand-sage/10 text-brand-sage">
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

            {!loading && filteredGroups.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {filteredGroups.map((group) => {
                  const groupMembers = membersForGroup(group.id);
                  const leaders = groupMembers.filter((member) =>
                    (member.role || "").toLowerCase().includes("leader")
                  );
                  const displayedLeaders = leaders.slice(0, 3);

                  return (
                    <Card key={group.id} className="group actsix-panel-soft flex min-h-44 flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-brand-sage/40 hover:shadow-md">
                      <Link
                        to={`/groups/${group.id}`}
                        className="flex min-h-0 flex-1 flex-col p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span className="inline-flex rounded-[var(--radius-control)] bg-brand-sage-soft px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[0.14em] text-brand-sage">
                            {folderName(group.folder_id)}
                          </span>
                          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:text-brand-teal" />
                        </div>

                        <div className="mt-3 min-w-0">
                          <h2 className="truncate text-lg font-extrabold tracking-tight text-foreground transition group-hover:text-brand-teal">
                            {group.name}
                          </h2>
                          <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-muted-foreground">
                            {group.description || "Open group details to add people and manage roles."}
                          </p>
                        </div>

                        <div className="actsix-interactive-row mt-3 bg-background/45 px-3 py-2">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            People
                          </p>
                          <p className="mt-1 text-xl font-extrabold leading-none text-foreground">
                            {groupMembers.length}
                          </p>
                        </div>

                        <div className="mt-auto pt-3">
                          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                            Group Leader{leaders.length === 1 ? "" : "s"}
                          </p>
                          {leaders.length === 0 ? (
                            <p className="mt-1.5 text-xs font-medium text-muted-foreground">
                              No leader assigned
                            </p>
                          ) : (
                            <div className="mt-1.5 flex min-w-0 flex-wrap gap-1.5">
                              {displayedLeaders.map((leader) => (
                                <div key={leader.id} className="flex min-w-0 items-center gap-1.5 rounded-full bg-muted/45 py-0.5 pl-0.5 pr-2">
                                  <PersonAvatar
                                    name={leader.people?.display_name}
                                    avatarUrl={leader.people?.avatar_url}
                                    size="xs"
                                  />
                                  <span className="max-w-28 truncate text-xs font-bold">
                                    {leader.people?.display_name || "Leader"}
                                  </span>
                                </div>
                              ))}
                              {leaders.length > displayedLeaders.length && (
                                <p className="text-xs font-semibold text-muted-foreground">
                                  +{leaders.length - displayedLeaders.length} more
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </Link>

                      <div className="flex items-center justify-between border-t border-border/70 px-3 py-1.5">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Open to manage people
                        </span>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground/60 transition hover:bg-muted hover:text-destructive"
                          onClick={() => deleteGroup(group)}
                          aria-label="Delete group"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={createGroupOpen} onOpenChange={setCreateGroupOpen}>
        <DialogContent className="max-w-xl">
            <form onSubmit={createGroup} className="space-y-4">
              <DialogHeader>
                <p className="label-eyebrow">People Group</p>
                <DialogTitle className="text-xl">Create Group</DialogTitle>
                <DialogDescription>
                  Add a new group, then open it to add people and assign leaders.
                </DialogDescription>
              </DialogHeader>

              <div>
                <label className="label-eyebrow">Group Name</label>
                <Input
                  value={newGroupName}
                  onChange={(event) => setNewGroupName(event.target.value)}
                  placeholder="Brandon’s Bible Study"
                  className="mt-1.5 h-10 rounded-[var(--radius-control)] border-border/70 bg-background"
                  autoFocus
                />
              </div>

              <div>
                <label className="label-eyebrow">Folder</label>
                <select
                  value={newGroupFolderId}
                  onChange={(event) => setNewGroupFolderId(event.target.value)}
                  className="mt-1.5 h-10 w-full rounded-[var(--radius-control)] border border-border/70 bg-background px-3 text-sm outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/15"
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
                  className="mt-1.5 h-10 rounded-[var(--radius-control)] border-border/70 bg-background"
                />
              </div>

              <DialogFooter className="flex justify-end gap-2 border-t border-border/70 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="actsix-btn-outline"
                  onClick={() => setCreateGroupOpen(false)}
                >
                  Cancel
                </Button>

                <Button
                  type="submit"
                  className="actsix-btn-primary"
                  disabled={!newGroupName.trim()}
                >
                  <Plus className="h-4 w-4" />
                  Create Group
                </Button>
              </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PeopleGroupsPage;
