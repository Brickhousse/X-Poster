"use server";

import { auth } from "@clerk/nextjs/server";
import { getSupabaseClient } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";

export interface UserSettings {
  xTier: "free" | "premium";
  hasOpenaiKey: boolean;
}

export async function getSettings(): Promise<UserSettings> {
  const { userId } = await auth();
  if (!userId) return { xTier: "free", hasOpenaiKey: false };

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("user_settings")
    .select("x_tier, openai_api_key")
    .eq("user_id", userId)
    .single();

  let hasOpenaiKey = false;
  if (data?.openai_api_key) {
    try {
      decrypt(data.openai_api_key as string);
      hasOpenaiKey = true;
    } catch {
      hasOpenaiKey = false;
    }
  }

  return {
    xTier: (data?.x_tier as "free" | "premium") ?? "free",
    hasOpenaiKey,
  };
}
