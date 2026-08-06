import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type MeetingTranscriptionModalProps = {
  open: boolean;
  onClose: () => void;
  transcriptFile: File | null;
  onFileChange: (file: File | null) => void;
  transcribing: boolean;
  onTranscribe: () => void;
  transcriptText: string;
  onTranscriptChange: (value: string) => void;
  generatedMinutes: string;
  onGeneratedMinutesChange: (value: string) => void;
  generatedActionPoints: string[];
  onClearGenerated: () => void;
  processingTranscript: boolean;
  onProcessTranscript: () => void;
  onCopyGeneratedNotes: () => void;
};

/**
 * Upload-recording / local-transcriber panel, gated behind
 * VITE_ACTSIX_TRANSCRIBER_ENABLED by the parent. Talks to a hardcoded
 * localhost transcriber server - only works for someone running that
 * server on their own machine, not a production feature.
 */
export function MeetingTranscriptionModal({
  open,
  onClose,
  transcriptFile,
  onFileChange,
  transcribing,
  onTranscribe,
  transcriptText,
  onTranscriptChange,
  generatedMinutes,
  onGeneratedMinutesChange,
  generatedActionPoints,
  onClearGenerated,
  processingTranscript,
  onProcessTranscript,
  onCopyGeneratedNotes,
}: MeetingTranscriptionModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center px-4">
      <Card className="w-full max-w-4xl max-h-[86vh] overflow-auto border-border/70 bg-card shadow-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <p className="label-eyebrow">Meeting Transcription</p>
            <h2 className="mt-1 text-xl font-extrabold tracking-tight">
              Upload Recording
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload an audio recording and transcribe it locally using the ACTSIX transcriber server.
            </p>
          </div>

          <Button type="button" variant="outline" className="rounded-xl" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-border/70 bg-background p-4">
              <label className="label-eyebrow">Audio File</label>

              <input
                type="file"
                accept="audio/*,video/*"
                onChange={(event) => onFileChange(event.target.files?.[0] || null)}
                className="mt-3 block w-full text-sm text-muted-foreground file:mr-4 file:rounded-lg file:border-0 file:bg-brand-teal/10 file:px-3 file:py-2 file:text-sm file:font-bold file:text-brand-teal hover:file:bg-brand-teal/15"
              />

              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Supported files depend on your local ffmpeg setup. MP3, WAV, M4A, and MP4 are good starting points.
              </p>

              <Button
                type="button"
                className="actsix-btn-primary min-h-10 rounded-xl mt-4 w-full"
                onClick={onTranscribe}
                disabled={!transcriptFile || transcribing}
              >
                {transcribing ? "Transcribing..." : "Transcribe"}
              </Button>
            </div>

            <div className="rounded-xl border border-border/70 bg-background p-4">
              <div className="flex flex-wrap items-center justify-start gap-3 mb-3">
                <label className="label-eyebrow">Transcript</label>

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
                value={transcriptText}
                onChange={(event) => onTranscriptChange(event.target.value)}
                placeholder="Transcript will appear here..."
                className="w-full min-h-[240px] resize-y rounded-[var(--radius-control)] border border-border/70 bg-card p-3 text-sm leading-6 outline-none transition focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/15"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-background p-4">
            <div className="flex flex-wrap items-center justify-start gap-3 mb-3">
              <label className="label-eyebrow">Generated Meeting Notes</label>

              {generatedMinutes.trim() && (
                <button
                  type="button"
                  className="text-xs font-bold text-muted-foreground hover:text-brand-teal"
                  onClick={onClearGenerated}
                >
                  Clear
                </button>
              )}
            </div>

            <textarea
              value={generatedMinutes}
              onChange={(event) => onGeneratedMinutesChange(event.target.value)}
              placeholder="Generated minutes and action points will appear here..."
              className="w-full min-h-[240px] resize-y rounded-[var(--radius-control)] border border-border/70 bg-card p-3 text-sm leading-6 outline-none transition focus-visible:border-brand-teal focus-visible:ring-2 focus-visible:ring-brand-teal/15"
            />

            {generatedActionPoints.length > 0 && (
              <div className="mt-4 rounded-xl border border-border/70 bg-card p-4">
                <p className="label-eyebrow">Extracted Action Points</p>

                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {generatedActionPoints.map((point, index) => (
                    <li key={`${point}-${index}`} className="leading-6">
                      • {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={onProcessTranscript}
              disabled={!transcriptText.trim() || processingTranscript}
            >
              {processingTranscript ? "Generating..." : "Generate Minutes"}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={onCopyGeneratedNotes}
              disabled={!generatedMinutes.trim()}
            >
              Copy Generated Notes
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
