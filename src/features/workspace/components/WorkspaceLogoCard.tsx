import { useRef, useState } from "react";
import { ImagePlus, Stamp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { friendlyErrorMessage } from "@/lib/friendlyError";
import { uploadWorkspaceLogo } from "@/features/workspace/lib/uploadWorkspaceLogo";

export type WorkspaceLogoCardProps = {
  workspaceId: string;
  workspaceName: string;
  logoUrl: string | null;
  userId?: string | null;
  /** True when the signed-in person may change workspace-wide settings. */
  canEdit: boolean;
  onChange: (logoUrl: string | null) => void;
};

/**
 * Upload and preview the workspace logo used on printed documents.
 *
 * The preview is shown on white at roughly its printed size rather than on the
 * app's parchment - a mark that looks right against a warm UI can disappear on
 * paper, and paper is the only place this image is ever used.
 */
export function WorkspaceLogoCard({
  workspaceId,
  workspaceName,
  logoUrl,
  userId,
  canEdit,
  onChange,
}: WorkspaceLogoCardProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [busy, setBusy] = useState(false);

  const persist = async (nextUrl: string | null) => {
    const { error } = await (supabase as any)
      .from("workspaces")
      .update({ logo_url: nextUrl })
      .eq("id", workspaceId);

    if (error) {
      toast.error(friendlyErrorMessage(error));
      return false;
    }

    onChange(nextUrl);
    return true;
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    setBusy(true);
    const result = await uploadWorkspaceLogo({ file, workspaceId, userId });

    if ("error" in result) {
      toast.error(result.error);
      setBusy(false);
      return;
    }

    if (await persist(result.url)) toast.success("Logo updated");
    setBusy(false);
  };

  const removeLogo = async () => {
    setBusy(true);
    if (await persist(null)) toast.success("Logo removed");
    setBusy(false);
  };

  return (
    <Card className="actsix-panel p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-brand-teal/10 p-3 text-brand-teal">
          <Stamp className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <p className="label-eyebrow">Printed Documents</p>
          <h2 className="mt-1 text-xl font-extrabold tracking-tight">Logo</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Printed and exported meeting minutes carry this above {workspaceName}'s name.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-[1rem] border border-border/70 bg-muted/10 p-3.5">
        <div className="flex h-[4.5rem] w-40 shrink-0 items-center justify-center rounded-[0.75rem] border border-border/70 bg-white p-2">
          {logoUrl ? (
            <img src={logoUrl} alt={`${workspaceName} logo`} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="text-xs font-bold text-muted-foreground">No logo yet</span>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-xs text-muted-foreground">
            PNG or SVG with a transparent background works best. Under 2MB.
          </p>

          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus className="mr-1.5 h-4 w-4" />
                {busy ? "Uploading..." : logoUrl ? "Replace" : "Upload logo"}
              </Button>

              {logoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-xl text-destructive"
                  disabled={busy}
                  onClick={removeLogo}
                >
                  <Trash2 className="mr-1.5 h-4 w-4" />
                  Remove
                </Button>
              )}

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  void handleFile(event.target.files?.[0]);
                  // Clear it, or choosing the same file twice in a row fires
                  // no change event and the upload silently doesn't happen.
                  event.target.value = "";
                }}
              />
            </div>
          ) : (
            <p className="text-xs font-bold text-muted-foreground">
              Only workspace admins can change the logo.
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
