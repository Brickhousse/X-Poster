"use server";

import { auth } from "@clerk/nextjs/server";
import { getSupabaseClient } from "@/lib/supabase";
import { randomUUID } from "crypto";
import { z } from "zod";

const BUCKET = "post-images";
const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

const schema = z.object({
  dataUrl: z.string().regex(/^data:image\//),
});

export async function uploadCustomImage(dataUrl: string): Promise<{ url: string } | { error: string }> {
  const parsed = schema.safeParse({ dataUrl });
  if (!parsed.success) return { error: "Invalid image format." };

  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  try {
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx === -1) return { error: "Invalid image data." };
    const header = dataUrl.slice(0, commaIdx);
    const base64 = dataUrl.slice(commaIdx + 1);
    const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/jpeg";
    const buffer = Buffer.from(base64, "base64");
    const path = `${userId}/${randomUUID()}`;
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      contentType: mimeType,
      upsert: false,
    });
    if (error) return { error: "Upload failed." };
    return { url: `${BASE}${path}` };
  } catch {
    return { error: "Upload failed." };
  }
}
