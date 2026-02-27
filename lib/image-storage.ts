import { getSupabaseClient } from "@/lib/supabase";
import { randomUUID } from "crypto";

const BUCKET = "post-images";
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

// Download a URL and upload to Supabase Storage.
// Returns the permanent public Storage URL, or null on failure.
export async function uploadImageFromUrl(grokUrl: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(grokUrl);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const path = `${userId}/${randomUUID()}`;
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType,
      upsert: false,
    });
    if (error) return null;
    return `${BASE}${path}`;
  } catch {
    return null;
  }
}

// Delete Storage files for a list of public Storage URLs.
// Silently ignores URLs that are not Storage paths.
export async function deleteStorageImages(urls: string[]): Promise<void> {
  const paths = urls
    .filter((u) => u.startsWith(BASE))
    .map((u) => u.slice(BASE.length));
  if (paths.length === 0) return;
  const supabase = getSupabaseClient();
  await supabase.storage.from(BUCKET).remove(paths);
}
