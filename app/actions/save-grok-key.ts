"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";

const schema = z.object({
  grokApiKey: z.string().min(1, "API key is required").max(200),
});

type SaveGrokKeyResult = { ok: true } | { error: string };

export async function saveGrokKey(grokApiKey: string): Promise<SaveGrokKeyResult> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const parsed = schema.safeParse({ grokApiKey });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("user_credentials")
    .upsert(
      { user_id: userId, grok_api_key: encrypt(parsed.data.grokApiKey), updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    );

  if (error) return { error: "Failed to save API key." };
  return { ok: true };
}
