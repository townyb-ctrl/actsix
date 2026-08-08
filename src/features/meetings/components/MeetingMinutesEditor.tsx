import { useEffect, useRef, useState } from "react";
import { Bold, Heading1, Heading2, Italic, Mic, Pilcrow } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMinutesDocumentHtml, renderMinutesHtml } from "@/features/meetings/lib/meetingMinutes";

export type MeetingMinutesEditorProps = {
  notes: string | null;
  onSave: (html: string) => void;
  onOpenTranscript: () => void;
  /** True while a save request is in flight. */
  saving?: boolean;
  /** When the last successful save landed, or null if nothing has saved yet. */
  savedAt?: Date | null;
};

/** Idle time before minutes save themselves, in ms. */
const AUTOSAVE_DELAY = 2000;

const runMinutesCommand = (minutesRef: React.RefObject<HTMLDivElement>, command: string, value?: string) => {
  minutesRef.current?.focus();
  document.execCommand(command, false, value);
};

/**
 * The rich-text minutes editor - a contentEditable div plus a small format
 * toolbar. Owns its own DOM ref, debounced autosave and save-on-blur, so the
 * parent only needs to hand it the current notes and a save callback.
 *
 * Minutes are the longest-lived, most-easily-lost thing anyone types in this
 * app. Saving only on blur meant a closed laptop lid lost the lot, so typing
 * now saves itself after a short pause and the header says when it last did.
 */
export function MeetingMinutesEditor({
  notes,
  onSave,
  onOpenTranscript,
  saving = false,
  savedAt = null,
}: MeetingMinutesEditorProps) {
  const minutesRef = useRef<HTMLDivElement | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const [unsaved, setUnsaved] = useState(false);
  const autosaveRef = useRef<number | null>(null);

  const runCommand = (command: string, value?: string) => runMinutesCommand(minutesRef, command, value);

  const saveNow = () => {
    if (autosaveRef.current !== null) {
      window.clearTimeout(autosaveRef.current);
      autosaveRef.current = null;
    }

    setUnsaved(false);
    onSave(getMinutesDocumentHtml(minutesRef.current) || notes || "");
  };

  const queueAutosave = () => {
    setUnsaved(true);

    if (autosaveRef.current !== null) window.clearTimeout(autosaveRef.current);
    autosaveRef.current = window.setTimeout(saveNow, AUTOSAVE_DELAY);
  };

  // The flush below runs from a mount-once effect, so it has to reach the
  // current saveNow rather than the one captured on first render — that one
  // closes over a parent still holding a null meeting and silently no-ops.
  const saveNowRef = useRef(saveNow);
  saveNowRef.current = saveNow;

  // A pending edit must not die with the component (route change, tab close).
  useEffect(() => {
    const flush = () => {
      if (autosaveRef.current !== null) saveNowRef.current();
    };

    window.addEventListener("pagehide", flush);

    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);

  const savedLabel = saving
    ? "Saving..."
    : unsaved
      ? "Unsaved changes"
      : savedAt
        ? `Saved ${savedAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
        : null;

  return (
    <Card className="actsix-panel overflow-hidden">
      <div className="border-b border-border/70 bg-background/55 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold tracking-tight">Meeting Minutes</h2>
            {savedLabel && (
              <p
                className="mt-0.5 truncate text-xs font-semibold text-muted-foreground"
                role="status"
                aria-live="polite"
              >
                {savedLabel}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal sm:h-8"
              onClick={() => setToolbarOpen((open) => !open)}
            >
              {toolbarOpen ? "Hide Format" : "Format"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-11 rounded-lg border-border/70 font-semibold hover:border-brand-teal/30 hover:bg-brand-teal/10 hover:text-brand-teal sm:h-8"
              onClick={onOpenTranscript}
            >
              <Mic className="h-4 w-4 mr-1.5" />
              Record &amp; Transcribe
            </Button>
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
              className="h-11 w-11 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal sm:h-8 sm:w-8"
              title="Bold"
              aria-label="Bold"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("bold")}
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal sm:h-8 sm:w-8"
              title="Italic"
              aria-label="Italic"
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
              className="h-11 w-11 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal sm:h-8 sm:w-8"
              title="Heading 1"
              aria-label="Heading 1"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("formatBlock", "h1")}
            >
              <Heading1 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal sm:h-8 sm:w-8"
              title="Heading 2"
              aria-label="Heading 2"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("formatBlock", "h2")}
            >
              <Heading2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-lg text-muted-foreground hover:bg-brand-teal/10 hover:text-brand-teal sm:h-8 sm:w-8"
              title="Body text"
              aria-label="Body text"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => runCommand("formatBlock", "div")}
            >
              <Pilcrow className="h-4 w-4" />
            </Button>

            <select
              className="ml-1 h-11 rounded-lg border border-border/70 sm:h-8 bg-background px-2 text-xs font-semibold text-muted-foreground outline-none focus:border-brand-teal/40 focus:ring-2 focus:ring-brand-teal/15"
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
          className="minutes-document min-h-[26.25rem] h-[calc(100vh-25rem)] max-h-[58rem] overflow-y-auto cursor-text rounded-xl border border-border/70 bg-background/70 p-4 text-sm leading-6 text-foreground outline-none transition focus:border-brand-teal/35 focus:bg-background focus:ring-2 focus:ring-brand-teal/15"
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
          onInput={queueAutosave}
          onBlur={saveNow}
        />
      </div>
    </Card>
  );
}
