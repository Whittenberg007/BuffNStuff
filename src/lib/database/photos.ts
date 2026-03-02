import { createClient } from "@/lib/supabase/client";
import type { ProgressPhoto, PhotoPose } from "@/types";

const BUCKET = "progress-photos";

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function uploadProgressPhoto(
  date: string,
  pose: PhotoPose,
  fileOrDataUrl: File | string
): Promise<ProgressPhoto> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const storagePath = `${user.id}/${date}_${pose}.jpg`;

  const fileToUpload =
    typeof fileOrDataUrl === "string"
      ? dataUrlToBlob(fileOrDataUrl)
      : fileOrDataUrl;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, fileToUpload, {
      upsert: true,
      contentType: "image/jpeg",
    });
  if (uploadError) throw uploadError;

  // Upsert the DB row (same date + pose = replace)
  const { data: existing } = await supabase
    .from("progress_photos")
    .select("id")
    .eq("user_id", user.id)
    .eq("date", date)
    .eq("pose", pose)
    .single();

  if (existing) {
    const { data, error } = await supabase
      .from("progress_photos")
      .update({ storage_path: storagePath })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as ProgressPhoto;
  }

  const { data, error } = await supabase
    .from("progress_photos")
    .insert({
      user_id: user.id,
      date,
      pose,
      storage_path: storagePath,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ProgressPhoto;
}

export async function getProgressPhotos(
  days: number = 365
): Promise<ProgressPhoto[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("progress_photos")
    .select("*")
    .eq("user_id", user.id)
    .gte("date", startDateStr)
    .order("date", { ascending: false });

  if (error) throw error;
  return data as ProgressPhoto[];
}

export async function getPhotoUrl(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteProgressPhoto(id: string): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: photo, error: fetchError } = await supabase
    .from("progress_photos")
    .select("storage_path")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (fetchError) throw fetchError;

  if (photo) {
    await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  }

  const { error } = await supabase
    .from("progress_photos")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) throw error;
}
