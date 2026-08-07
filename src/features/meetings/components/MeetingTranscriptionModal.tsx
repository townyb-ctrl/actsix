import { Mic, Square, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PeopleSearchSelect } from "@/components/people/PeopleSearchSelect";
import { fieldControlClass } from "@/components/ui/field";
import type { ActionPointProposal, MeetingPersonProfile } from "@/features/meetings/lib/meetingTypes";

export type MeetingTranscriptionModalProps = {
  open: boolean;
  onClose: () => void;

  isRecording: boolean;
  recordingSeconds: number;
  onStartRecording: () => void;
  onStopRecording: () => void;

  hasAudioSource: boolean;
  audioSourceLabel: string;
  onFileChange: (file: File | null) => void;

  transcribing: boolean;
  onTranscribe: () => void;
  transcriptText: string;
  onTranscriptChange: (value: string) => void;

  generatingMinutes: boolean;
  onGenerateMinutes: () => void;
  generatedMinutes: string;
  onCopyGeneratedNotes: () => void;

  actionProposals: ActionPointProposal[];
  meetingActionPeople: MeetingPersonProfile[];
  onUpdateProposal: (id: string, patch: Partial<ActionPointProposal>) => void;
  onDismissProposal: (id: string) => void;
  onConfirmProposal: (id: string) => void;
  onConfirmAllProposals: () => void;
};

const formatSeconds = (totalSeconds: number) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

/**
 * Record (or upload) audio, transcribe it, then have AI draft minutes and
 * propose action points. Action points land here for review - each one is
 * editable and must be confirmed before it becomes a real MeetingAction, so
 * a mis-heard name or date never lands silently in someone's task list.
 */
export function MeetingTranscriptionModal({
  open,
  onClose,
  isRecording,
  recordingSeconds,
  onStartRecording,
  onStopRecording,
  hasAudioSource,
  audioSourceLabel,
  onFileChange,
  transcribing,
  onTranscribe,
  transcriptText,
  onTranscriptChange,
  generatingMinutes,
  onGenerateMinutes,
  generatedMinutes,
  onCopyGeneratedNotes,
  actionProposals,
  meetingActionPeople,
  onUpdateProposal,
  onDismissProposal,
  onConfirmProposal,
  onConfirmAllProposals,
}: MeetingTranscriptionModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
      <Card className="w-full max-w-4xl max-h-[86vh] overflow-auto border-border/70 bg-card shadow-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <p className="label-eyebrow">Meeting Recording</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              Record &amp; Transcribe
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Record this meeting, or upload a recording made elsewhere, then let AI draft the minutes and action points.
            </p>
          </div>

          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background p-4">
              <p className="label-eyebrow">Audio</p>

              <div className="mt-3 flex items-center gap-3">
                {isRecording ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-10 rounded-xl"
                    onClick={onStopRecording}
                  >
                    <Square className="h-4 w-4 mr-1.5" />
                    Stop ({formatSeconds(recordingSeconds)})
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="actsix-btn-primary min-h-10 rounded-xl"
                    onClick={onStartRecording}
                  >
                    <Mic className="h-4 w-4 mr-1.5" />
                    Record
                  </Button>
                )}

                {isRecording && (
                  <span className="inline-flex h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive" aria-hidden="true" />
                )}
              </div>

              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Or upload a recording made elsewhere (phone, Zoom).
              </p>

              <label htmlFor="transcript-audio-file" className="sr-only">Upload audio file</label>
              <input
                id="transcript-audio-file"
                type="file"
                accept="audio/*,video/*"
                disabled={isRecording}
                onChange={(event) => onFileChange(event.target.files?.[0] || null)}
                className="mt-2 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-brand-teal/10 file:px-3 file:py-2 file:text-sm file:font-bold file:text-brand-teal hover:file:bg-brand-teal/15 disabled:opacity-50"
              />

              {hasAudioSource && !isRecording && (
                <p className="mt-2 truncate text-xs font-semibold text-brand-teal">{audioSourceLabel} ready</p>
              )}

              <Button
                type="button"
                className="actsix-btn-primary min-h-10 rounded-xl mt-4 w-full"
                onClick={onTranscribe}
                disabled={!hasAudioSource || isRecording || transcribing}
              >
                {transcribing ? "Transcribing..." : "Transcribe"}
              </Button>
            </div>

            <div className="rounded-xl border border-border/70 bg-background p-4">
              <div className="flex flex-wrap items-center justify-start gap-3 mb-3">
                <label htmlFor="transcript-text" className="label-eyebrow">Transcript</label>

                {transcriptText.trim() && (
                  <button
                    type="button"
                    className="text-xs font-bold text-muted-foreground hover:text-brand-teal"
                    onClick={() => onTranscriptChange("")}
                  >
                    Clear
                  </button>
                )}
              </div>

              <textarea
                id="transcript-text"
                value={transcriptText}
                onChange={(event) => onTranscriptChange(event.target.value)}
                placeholder="Transcript will appear here..."
                className="w-full min-h-[240px] resize-y rounded-[var(--radius-control)] border border-border/70 bg-card p-3 text-sm leading-6 outline-none transition focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/15"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <label htmlFor="generated-minutes" className="label-eyebrow">Generated Minutes</label>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg"
                onClick={onGenerateMinutes}
                disabled={!transcriptText.trim() || generatingMinutes}
              >
                {generatingMinutes ? "Generating..." : "Generate Minutes"}
              </Button>
            </div>

            <textarea
              id="generated-minutes"
              value={generatedMinutes}
              readOnly
              placeholder="AI-drafted minutes will appear here..."
              className="w-full min-h-[200px] resize-y rounded-[var(--radius-control)] border border-border/70 bg-card p-3 text-sm leading-6 outline-none transition focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/15"
            />

            <Button
              type="button"
              variant="outline"
              className="rounded-xl mt-3"
              onClick={onCopyGeneratedNotes}
              disabled={!generatedMinutes.trim()}
            >
              Merge Into Meeting Minutes
            </Button>
          </div>

          {actionProposals.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-background p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                <p className="label-eyebrow">Review Action Points ({actionProposals.length})</p>
                <Button type="button" size="sm" className="actsix-btn-primary h-8 rounded-lg" onClick={onConfirmAllProposals}>
                  Add All
                </Button>
              </div>

              <div className="space-y-3">
                {actionProposals.map((proposal) => (
                  <div key={proposal.id} className="space-y-2 rounded-xl border border-border/70 bg-card p-3">
                    <Input
                      value={proposal.title}
                      onChange={(event) => onUpdateProposal(proposal.id, { title: event.target.value })}
                      placeholder="Action point..."
                      aria-label="Action point title"
                      className={fieldControlClass}
                    />

                    <PeopleSearchSelect
                      people={meetingActionPeople}
                      selectedPersonId={proposal.assigneePersonId}
                      onSelect={(personId) => {
                        const person = meetingActionPeople.find((option) => option.id === personId);
                        onUpdateProposal(proposal.id, {
                          assigneePersonId: personId,
                          assigneeName: person?.display_name || proposal.assigneeName,
                        });
                      }}
                      placeholder={proposal.assigneeName ? `AI heard "${proposal.assigneeName}" - confirm person...` : "Search meeting people..."}
                      emptyText="No matching meeting people found."
                      zIndexClass="z-20"
                      dropdownZIndexClass="z-30"
                    />

                    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
                      <Input
                        type="date"
                        value={proposal.due}
                        aria-label="Due date"
                        onChange={(event) => onUpdateProposal(proposal.id, { due: event.target.value })}
                        className={fieldControlClass}
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Dismiss proposed action point"
                        className="h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => onDismissProposal(proposal.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>

                      <Button
                        type="button"
                        className="actsix-btn-primary h-10 rounded-xl px-4"
                        onClick={() => onConfirmProposal(proposal.id)}
                        disabled={!proposal.title.trim()}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
