import { UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PeopleMultiSearchSelect } from "@/components/people/PeopleMultiSearchSelect";
import { MeetingSourceCombobox, type MeetingSourceOption } from "@/features/meetings/components/MeetingSourceCombobox";
import type {
  MeetingGroupSource,
  MeetingFolderSource,
  PersonOption,
} from "@/features/meetings/lib/meetingTypes";

export type MeetingPeopleSourcesModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meetingActionPeopleCount: number;
  chairpersonId: string;
  onChairpersonChange: (personId: string) => void;
  minuteTakerId: string;
  onMinuteTakerChange: (personId: string) => void;
  meetingLeaderOptions: MeetingSourceOption[];
  meetingPeopleCount: number;
  onOpenAttendance: () => void;
  peopleOptions: PersonOption[];
  selectedMeetingPersonIds: string[];
  onSelectedMeetingPersonIdsChange: (ids: string[]) => void;
  onAddMeetingPeopleSources: () => void;
  selectedMeetingGroupFolderId: string;
  onSelectedMeetingGroupFolderIdChange: (value: string) => void;
  meetingGroupFolderOptions: MeetingSourceOption[];
  onAddMeetingGroupOrFolderSource: () => void;
  meetingGroupSources: MeetingGroupSource[];
  meetingFolderSources: MeetingFolderSource[];
};

export function MeetingPeopleSourcesModal({
  open,
  onOpenChange,
  meetingActionPeopleCount,
  chairpersonId,
  onChairpersonChange,
  minuteTakerId,
  onMinuteTakerChange,
  meetingLeaderOptions,
  meetingPeopleCount,
  onOpenAttendance,
  peopleOptions,
  selectedMeetingPersonIds,
  onSelectedMeetingPersonIdsChange,
  onAddMeetingPeopleSources,
  selectedMeetingGroupFolderId,
  onSelectedMeetingGroupFolderIdChange,
  meetingGroupFolderOptions,
  onAddMeetingGroupOrFolderSource,
  meetingGroupSources,
  meetingFolderSources,
}: MeetingPeopleSourcesModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="actsix-panel flex h-[88vh] max-w-6xl flex-col overflow-hidden rounded-xl">
        <DialogHeader>
          <DialogTitle>Edit People</DialogTitle>
          <DialogDescription>
            Add individuals, groups, or folders to define who belongs in this meeting.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-6 pr-2">
          <Card className="actsix-panel-soft mb-4 p-4">
            <div className="mb-4">
              <p className="label-eyebrow">Meeting Leadership</p>
              <h2 className="mt-1 text-xl font-extrabold tracking-tight">
                Chairperson and minute taker
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Select from the people already connected to this meeting.
              </p>
            </div>

            {meetingActionPeopleCount === 0 ? (
              <div className="actsix-empty-state p-4 text-left text-sm">
                Add people to this meeting before assigning a chairperson or minute taker.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="actsix-panel-soft p-4">
                  <label className="label-eyebrow">Chairperson</label>
                  <div className="mt-2">
                    <MeetingSourceCombobox
                      value={chairpersonId}
                      onChange={onChairpersonChange}
                      options={meetingLeaderOptions}
                      placeholder="Select chairperson..."
                      searchPlaceholder="Search meeting people..."
                      emptyText="No meeting people found."
                    />
                  </div>
                </div>

                <div className="actsix-panel-soft p-4">
                  <label className="label-eyebrow">Minute taker</label>
                  <div className="mt-2">
                    <MeetingSourceCombobox
                      value={minuteTakerId}
                      onChange={onMinuteTakerChange}
                      options={meetingLeaderOptions}
                      placeholder="Select minute taker..."
                      searchPlaceholder="Search meeting people..."
                      emptyText="No meeting people found."
                    />
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card className="border-0 bg-transparent p-0 shadow-none">
            <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="label-eyebrow">Meeting People</p>
                <h2 className="mt-1 text-xl font-extrabold tracking-tight">People scope</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add individuals, groups, or folders to define who belongs in this meeting.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" className="rounded-xl" onClick={onOpenAttendance}>
                  <UsersRound className="h-4 w-4 mr-2" />
                  Attendance / Apologies
                </Button>

                <Badge variant="secondary" className="w-fit rounded-full">
                  {meetingPeopleCount} people
                </Badge>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <label className="label-eyebrow">Add individual</label>
                <div className="mt-2 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <PeopleMultiSearchSelect
                      people={peopleOptions}
                      selectedPersonIds={selectedMeetingPersonIds}
                      onChange={onSelectedMeetingPersonIdsChange}
                      placeholder="Search by name, email, or phone..."
                      emptyText="No matching People profiles found."
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={onAddMeetingPeopleSources}
                    disabled={selectedMeetingPersonIds.length === 0}
                  >
                    Add
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border/70 bg-background/70 p-3">
                <label className="label-eyebrow">Add group or folder</label>
                <div className="mt-2 flex gap-2">
                  <div className="min-w-0 flex-1">
                    <MeetingSourceCombobox
                      value={selectedMeetingGroupFolderId}
                      onChange={onSelectedMeetingGroupFolderIdChange}
                      options={meetingGroupFolderOptions}
                      placeholder="Search groups and folders..."
                      searchPlaceholder="Search groups or folders..."
                      emptyText="No groups or folders found."
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    onClick={onAddMeetingGroupOrFolderSource}
                    disabled={!selectedMeetingGroupFolderId}
                  >
                    Add
                  </Button>
                </div>

                {(meetingGroupSources.length > 0 || meetingFolderSources.length > 0) && (
                  <div className="mt-3 flex flex-wrap gap-2" aria-label="Connected source pills">
                    {meetingGroupSources.map((source) => (
                      <Badge
                        key={`group-pill-${source.id}`}
                        variant="outline"
                        className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground"
                      >
                        Group: {source.people_groups?.name || "Unnamed group"}
                      </Badge>
                    ))}

                    {meetingFolderSources.map((source) => (
                      <Badge
                        key={`folder-pill-${source.id}`}
                        variant="outline"
                        className="rounded-full bg-background px-3 py-1 text-xs font-semibold text-muted-foreground"
                      >
                        Folder: {source.people_group_folders?.name || "Unnamed folder"}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
