"use server";

import { auth } from "@clerk/nextjs/server";
import { getSupabaseClient } from "@/lib/supabase";

export interface SessionStatus {
  hasGrokKey: boolean;
  hasXToken: boolean;
}

export async function getSessionStatus(): Promise<SessionStatus> {
  const { userId } = await auth();
  if (!userId) return { hasGrokKey: false, hasXToken: false };

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("user_credentials")
    .select("grok_api_key, x_access_token")
    .eq("user_id", userId)
    .single();

  return {
    hasGrokKey: !!data?.grok_api_key,
    hasXToken: !!data?.x_access_token,
  };
}
