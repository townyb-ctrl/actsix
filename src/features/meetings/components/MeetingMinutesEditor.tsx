import { useRef, useState } from "react";
import { Bold, FileText, Heading1, Heading2, Italic, Mic, Pilcrow } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMinutesDocumentHtml, renderMinutesHtml } from "@/features/meetings/lib/meetingMinutes";

export type MeetingMinutesEditorProps = {
  notes: string | null;
  onSave: (html: string) => void;
  transcriberEnabled: boolean;
  onOpenTranscript: () => void;
  onOpenAgenda: () => void;
};

const runMinutesCommand = (minutesRef: React.RefObject<HTMLDivElement>, command: string, value?: string) => {
  minutesRef.current?.focus();
  document.execCommand(command, false, value);
};

/**
 * The rich-text minutes editor - a contentEditable div plus a small format
 * toolbar. Owns its own DOM ref and save-on-blur, so the parent only needs
 * to hand it the current notes and a save callback.
 */
export function MeetingMinutesEditor({
  notes,
  onSave,
  transcriberEnabled,
  onOpenTranscript,
  onOpenAgenda,
}: MeetingMinutesEditorProps) {
  const minutesRef = useRef<HTMLDivElement | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);

  const runCommand = (command: string, value?: string) => runMinutesCommand(minutesRef, command, value);

  return (
    <Card className="actsix-panel overflow-hidden">
      <style>{`
        .minutes-document:empty::before {
          content: attr(data-placeholder);
          color: hsl(var(--muted-foreground));
        }

        .minutes-section-heading {
          margin-top: 0.75rem;
          margin-bottom: 0.15rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: hsl(var(--foreground));
        }

        .minutes-section-heading:first-child {
          margin-top: 0;
        }

        .minutes-agenda-point {
          margin-top: 0.45rem;
          margin-bottom: 0.1rem;
          font-weight: 700;
          color: hsl(var(--foreground));
        }

        .minutes-document .minutes-blank-line {
          min-height: 0.15rem;
          line-height: 0.15rem;
        }

        .minutes-document div {
          min-height: 1.4em;
        }

        .minutes-document h1 {
          margin: 0.35rem 0 0.2rem;
          font-size: 1.25rem;
          line-height: 1.4;
          font-weight: 800;
          color: hsl(var(--foreground));
        }

        .minutes-document h2 {
          margin: 0.3rem 0 0.15rem;
          font-size: 1.05rem;
          line-height: 1.45;
          font-weight: 800;
          color: hsl(var(--foreground));
        }

        .minutes-document b,
        .minutes-document strong {
          font-weight: 800;
          color: hsl(var(--foreground));
        }

        .minutes-document i,
        .minutes-document em {
          font-style: italic;
        }
      `}</style>

      <div className="border-b border-border/70 bg-background/55 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight">Meeting Minutes</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal"
              onClick={() => setToolbarOpen((open) => !open)}
            >
              {toolbarOpen ? "Hide Format" : "Format"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal"
              onClick={onOpenAgenda}
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Edit Agenda
            </Button>
            {transcriberEnabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal"
                onClick={onOpenTranscript}
              >
                <Mic className="h-4 w-4 mr-1.5" />
                Transcription
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        {toolbarOpen && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-border/70 pb-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
              title="Bold"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("bold")}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
              title="Italic"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("italic")}
            >
              <Italic className="h-4 w-4" />
            </Button>

            <div className="mx-1 h-5 w-px bg-border" />

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
              title="Heading 1"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("formatBlock", "h1")}
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
              title="Heading 2"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("formatBlock", "h2")}
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal"
              title="Body text"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("formatBlock", "div")}
            >
              <Pilcrow className="h-4 w-4" />
            </Button>

            <select
              className="ml-1 h-8 rounded-lg border border-border/70 bg-background px-2 text-xs font-semibold text-muted-foreground outline-none focus:border-brand-teal/40 focus:ring-2 focus:ring-brand-teal/15"
              defaultValue=""
              aria-label="Select minutes font"
              onChange={(event) => {
                if (!event.target.value) return;
                runCommand("fontName", event.target.value);
              }}
            >
              <option value="" disabled>
                Font
              </option>
              <option value="Manrope">Manrope</option>
              <option value="Inter Tight">Inter Tight</option>
              <option value="Montserrat">Montserrat</option>
              <option value="Georgia">Georgia</option>
              <option value="Arial">Arial</option>
              <option value="Courier New">Courier New</option>
            </select>
          </div>
        )}

        <div
          ref={minutesRef}
          contentEditable
          suppressContentEditableWarning
          className="minutes-document min-h-[26.25rem] h-[calc(100vh-25rem)] max-h-[58rem] overflow-y-auto cursor-text rounded-xl border border-border/70 bg-background/70 p-4 text-sm leading-7 text-foreground outline-none transition focus:border-brand-teal/35 focus:bg-background focus:ring-2 focus:ring-brand-teal/15"
          data-placeholder="Click here to add meeting notes, decisions, and minutes..."
          dangerouslySetInnerHTML={{ __html: renderMinutesHtml(notes || "") }}
          onKeyDown={(event) => {
            const isModifier = event.metaKey || event.ctrlKey;
            const key = event.key.toLowerCase();

            if (isModifier && key === "z") {
              event.preventDefault();
              document.execCommand(event.shiftKey ? "redo" : "undo");
            }

            if (isModifier && key === "y") {
              event.preventDefault();
              document.execCommand("redo");
            }
          }}
          onBlur={() => onSave(getMinutesDocumentHtml(minutesRef.current) || notes || "")}
        />
      </div>
    </Card>
  );
}
