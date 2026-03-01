"use server";

import { auth } from "@clerk/nextjs/server";
import { getSupabaseClient } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";

export interface InstagramStatus {
  connected: boolean;
  username?: string;
}

export async function getInstagramStatus(): Promise<InstagramStatus> {
  const { userId } = await auth();
  if (!userId) return { connected: false };

  const supabase = getSupabaseClient();
  const { data } = await supabase
    .from("user_credentials")
    .select("instagram_access_token, instagram_user_id, instagram_username")
    .eq("user_id", userId)
    .single();

  if (!data?.instagram_access_token) return { connected: false };

  try {
    decrypt(data.instagram_access_token as string);
    return {
      connected: true,
      username: (data.instagram_username as string | null) ?? undefined,
    };
  } catch {
    return { connected: false };
  }
}
