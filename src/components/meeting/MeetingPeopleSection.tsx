import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Mail, MoreHorizontal, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type MeetingPerson = {
  id: string;
  person_id: string;
  status?: string | null;
  people:
    | {
        display_name?: string;
        email?: string;
        avatar_url?: string | null;
        role?: string | null;
      }
    | Array<{
        display_name?: string;
        email?: string;
        avatar_url?: string | null;
        role?: string | null;
      }>;
};

export type InviteRecipient = {
  personId: string;
  displayName: string;
  email: string;
};

function getMeetingPersonInfo(meetingPerson: MeetingPerson) {
  const person = Array.isArray(meetingPerson.people)
    ? meetingPerson.people[0]
    : meetingPerson.people;

  return {
    displayName: person?.display_name || "Unknown person",
    email: person?.email || "No email",
    avatarUrl: person?.avatar_url || "",
    role: person?.role || null,
  };
}

function getMeetingPersonStatus(status?: string | null) {
  const rawStatus = String(status || "invited");

  switch (rawStatus) {
    case "invite_sent":
      return {
        label: "Invite Sent",
        className: "bg-brand-teal/10 text-brand-teal border-brand-teal/30",
      };
    case "attended":
      return {
        label: "Attending",
        className: "bg-brand-teal/10 text-brand-teal border-brand-teal/30",
      };
    case "unavailable":
      return {
        label: "Unavailable",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "apology":
      return {
        label: "Apology",
        className: "bg-amber-50 text-amber-700 border-amber-200",
      };
    case "absent":
      return {
        label: "Absent",
        className: "bg-rose-50 text-rose-700 border-rose-200",
      };
    case "not_required":
      return {
        label: "Not Required",
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
    default:
      return {
        label: rawStatus.replace(/_/g, " "),
        className: "bg-slate-100 text-slate-700 border-slate-200",
      };
  }
}

export function MeetingPeopleSection({
  meetingPeople,
  currentUserMeetingPerson,
  currentUserMeetingStatus,
  inviteRecipients,
  inviteOpen,
  inviteMessage,
  chairpersonId,
  minuteTakerId,
  onInviteOpen,
  onInviteClose,
  onInviteMessageChange,
  onSendInvites,
  onOpenPeopleDialog,
  onOpenMeetingPeopleDialog,
  onUpdateStatus,
  onRemoveMeetingPerson,
}: {
  meetingPeople: MeetingPerson[];
  currentUserMeetingPerson: MeetingPerson | null;
  currentUserMeetingStatus: string;
  inviteRecipients: InviteRecipient[];
  inviteOpen: boolean;
  inviteMessage: string;
  chairpersonId: string;
  minuteTakerId: string;
  onInviteOpen: () => void;
  onInviteClose: () => void;
  onInviteMessageChange: (value: string) => void;
  onSendInvites: () => Promise<void> | void;
  onOpenPeopleDialog: () => void;
  onOpenMeetingPeopleDialog: () => void;
  onUpdateStatus: (personId: string, status: string) => void;
  onRemoveMeetingPerson: (personId: string) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <div aria-label="Meeting people main list">
        <div className="border-b border-border/70 px-4 py-2.5">
          <div className="flex items-center justify-end gap-3">
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-xs font-semibold uppercase">
                {meetingPeople.length} people
              </Badge>
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-label="People actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>

                {menuOpen && (
                  <div className="absolute right-0 top-10 z-50 w-52 overflow-hidden rounded-xl border border-border/70 bg-card shadow-2xl">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenMeetingPeopleDialog();
                      }}
                    >
                      <UsersRound className="h-4 w-4" />
                      Edit people
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 border-t border-border/70 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted"
                      onClick={() => {
                        setMenuOpen(false);
                        onOpenPeopleDialog();
                      }}
                    >
                      <UsersRound className="h-4 w-4" />
                      Attendance
                    </button>
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 border-t border-border/70 px-3 py-2.5 text-left text-sm font-semibold transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-45"
                      onClick={() => {
                        setMenuOpen(false);
                        onInviteOpen();
                      }}
                      disabled={inviteRecipients.length === 0}
                    >
                      <Mail className="h-4 w-4" />
                      Mark invites sent
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5">
          {meetingPeople.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-4 text-sm text-muted-foreground">
              No people have been added to this meeting yet. Click <span className="font-semibold text-foreground">Edit People</span> to add individuals, groups, or folders.
            </div>
          ) : (
            <div className="max-h-[286px] space-y-1.5 overflow-y-auto pr-1">
              {meetingPeople.map((meetingPerson) => {
                const personInfo = getMeetingPersonInfo(meetingPerson);
                const roleLabels = [
                  meetingPerson.person_id === chairpersonId ? "Chairperson" : null,
                  meetingPerson.person_id === minuteTakerId ? "Minutes" : null,
                ].filter(Boolean);

                return (
                  <div
                    key={meetingPerson.id}
                    className="group flex items-center justify-between gap-2.5 rounded-lg border border-transparent bg-background/55 px-2.5 py-2 transition hover:border-border/70 hover:bg-background"
                  >
                    <div className="flex min-w-0 items-center gap-2 flex-1">
                      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-teal/10 text-[10px] font-extrabold text-brand-teal">
                        {personInfo.avatarUrl ? (
                          <img
                            src={personInfo.avatarUrl}
                            alt={personInfo.displayName}
                            className="absolute inset-0 h-full w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        ) : null}
                        <span className="relative z-0 flex h-full w-full items-center justify-center">
                          {!personInfo.avatarUrl && personInfo.displayName
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase())
                            .join("")}
                        </span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-extrabold leading-4 tracking-tight text-foreground">
                          {personInfo.displayName}
                        </p>
                        <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                          {personInfo.role && (
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              {personInfo.role}
                            </span>
                          )}
                          {roleLabels.length > 0 && (
                            <span className="text-[11px] font-semibold text-brand-teal">
                              {roleLabels.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant="outline"
                        className={`rounded-full capitalize text-xs px-2 py-0.5 ${getMeetingPersonStatus(meetingPerson.status).className}`}
                      >
                        {getMeetingPersonStatus(meetingPerson.status).label}
                      </Badge>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg text-muted-foreground opacity-60 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                        title="Remove from meeting"
                        onClick={() => onRemoveMeetingPerson(meetingPerson.person_id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <Dialog open={inviteOpen} onOpenChange={onInviteClose}>
        <DialogContent className="max-w-3xl rounded-2xl border-border/70 bg-card">
          <DialogHeader>
              <DialogTitle>Mark Meeting Invites Sent</DialogTitle>
            <DialogDescription>
              Review recipients and the invitation message before marking invites as sent.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 p-6">
            <div>
              <p className="label-eyebrow">Recipients</p>
              <div className="mt-3 space-y-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">Will receive invite</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {inviteRecipients.filter((recipient) => recipient.email.trim()).map((recipient) => (
                      <Badge
                        key={recipient.personId}
                        variant="outline"
                        className="rounded-full bg-card px-3 py-2 text-sm font-semibold text-muted-foreground"
                      >
                        {recipient.displayName}
                      </Badge>
                    ))}
                  </div>
                </div>

                {inviteRecipients.some((recipient) => !recipient.email.trim()) && (
                  <div>
                    <p className="text-sm font-semibold text-foreground">Missing email</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {inviteRecipients.filter((recipient) => !recipient.email.trim()).map((recipient) => (
                        <Badge
                          key={recipient.personId}
                          variant="outline"
                          className="rounded-full bg-card px-3 py-2 text-sm font-semibold text-muted-foreground"
                        >
                          {recipient.displayName}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {inviteRecipients.some((recipient) => !recipient.email.trim()) && (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Some people are missing email addresses and cannot receive real invites yet. This workflow currently only marks invite status as sent.
                </div>
              )}
            </div>

            <div>
              <label className="label-eyebrow">Invite message</label>
              <Textarea
                value={inviteMessage}
                onChange={(event) => onInviteMessageChange(event.target.value)}
                placeholder="Hey {{username}}, you have been invited to a {{meeting_name}} meeting. On {{meeting_date}} at {{meeting_time}}. Please respond with your availability."
                className="mt-3 min-h-[180px] border-border/70 bg-muted/10"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={onInviteClose}
            >
              Cancel
            </Button>
            <Button
              className="actsix-btn-primary rounded-xl"
              onClick={onSendInvites}
              disabled={inviteRecipients.length === 0}
            >
              Mark sent
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
