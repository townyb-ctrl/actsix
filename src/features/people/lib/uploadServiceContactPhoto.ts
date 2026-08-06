import { supabase } from "@/integrations/supabase/client";

const BUCKET = "service-contact-photos";
const MAX_BYTES = 5 * 1024 * 1024;

type UploadArgs = {
  file: File;
  workspaceId?: string | null;
  userId?: string | null;
};

type UploadResult = { url: string } | { error: string };

/**
 * Uploads a service contact photo and returns its public URL.
 *
 * The path is workspace-scoped (`<workspaceId>/<file>`) because the storage
 * policies read the workspace id out of the first path segment - putting the
 * file anywhere else fails the RLS check rather than leaking it.
 */
export const uploadServiceContactPhoto = async ({
  file,
  workspaceId,
  userId,
}: UploadArgs): Promise<UploadResult> => {
  if (!workspaceId || !userId) {
    return { error: "You need an active workspace before uploading a photo." };
  }

  if (!file.type.startsWith("image/")) {
    return { error: "Please choose an image file." };
  }

  if (file.size > MAX_BYTES) {
    return { error: "Images need to be under 5MB." };
  }

  const fileExt = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filePath = `${workspaceId}/${userId}-${Date.now()}.${fileExt}`;

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

    return { error: "Couldn't upload that image. Try again." };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

  if (!data.publicUrl) {
    return { error: "Could not generate a public image URL." };
  }

  return { url: data.publicUrl };
};
