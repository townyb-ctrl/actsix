import { supabase } from "@/integrations/supabase/client";

const BUCKET = "workspace-logos";
const MAX_BYTES = 2 * 1024 * 1024;

type UploadArgs = {
  file: File;
  workspaceId?: string | null;
  userId?: string | null;
};

type UploadResult = { url: string } | { error: string };

/**
 * Uploads a workspace logo and returns its public URL.
 *
 * The path is workspace-scoped (`<workspaceId>/<file>`) because the storage
 * policies read the workspace id out of the first path segment - putting the
 * file anywhere else fails the RLS check rather than leaking it.
 *
 * Smaller ceiling than a project cover: this is a letterhead mark printed at
 * around 16mm tall, so a 2MB budget is already generous and keeps the print
 * view from waiting on a photograph.
 */
export const uploadWorkspaceLogo = async ({
  file,
  workspaceId,
  userId,
}: UploadArgs): Promise<UploadResult> => {
  if (!workspaceId || !userId) {
    return { error: "You need an active workspace before uploading a logo." };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Please choose an image file." };
  }

  if (file.size > MAX_BYTES) {
    return { error: "Logos need to be under 2MB." };
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
  const filePath = `${workspaceId}/logo-${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

  if (uploadError) {
    const message = uploadError.message.toLowerCase();

    if (message.includes("bucket not found")) {
      return { error: `Create the ${BUCKET} storage bucket in Supabase, then upload again.` };
    }

    if (message.includes("row-level security")) {
      return { error: `Add the ${BUCKET} storage policies in Supabase, then upload again.` };
    }

    return { error: "Couldn't upload that logo. Try again." };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  if (!data.publicUrl) {
    return { error: "Could not generate a public logo URL." };
  }

  return { url: data.publicUrl };
};
