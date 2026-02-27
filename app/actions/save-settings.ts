"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";

const schema = z.object({
  xTier: z.enum(["free", "premium"]).optional(),
  openaiApiKey: z.string().max(200).optional(),
});

type SaveSettingsResult = { ok: true } | { error: string };

export async function saveSettings(input: {
  xTier?: "free" | "premium";
  openaiApiKey?: string;
}): Promise<SaveSettingsResult> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const upsertData: Record<string, unknown> = {
    user_id: userId,
    updated_at: new Date().toISOString(),
  };

  if (parsed.data.xTier !== undefined) {
    upsertData.x_tier = parsed.data.xTier;
  }
  if (parsed.data.openaiApiKey !== undefined) {
    upsertData.openai_api_key = parsed.data.openaiApiKey
      ? encrypt(parsed.data.openaiApiKey)
      : null;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("user_settings")
    .upsert(upsertData, { onConflict: "user_id" });

  if (error) return { error: "Failed to save settings." };
  return { ok: true };
}
