"use server";

import { auth } from "@clerk/nextjs/server";
import { TwitterApi } from "twitter-api-v2";
import { getSupabaseClient } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";

type TokenResult = { ok: true } | { error: string };

export async function exchangeXCode(
  code: string,
  codeVerifier: string,
  callbackUrl: string
): Promise<TokenResult> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const clientId = process.env.NEXT_PUBLIC_X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { error: "X OAuth credentials are not configured on the server." };
  }

  try {
    const client = new TwitterApi({ clientId, clientSecret });
    const { accessToken } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackUrl,
    });

    const supabase = getSupabaseClient();
    await supabase
      .from("user_credentials")
      .upsert(
        { user_id: userId, x_access_token: encrypt(accessToken), updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );

    return { ok: true };
  } catch {
    return { error: "Token exchange failed. Please try connecting again." };
  }
}
