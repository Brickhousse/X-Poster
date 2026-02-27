"use server";

import { auth } from "@clerk/nextjs/server";
import { getSupabaseClient } from "@/lib/supabase";

export async function disconnectX(): Promise<{ ok: true } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const supabase = getSupabaseClient();
  await supabase
    .from("user_credentials")
    .update({ x_access_token: null, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { ok: true };
}
