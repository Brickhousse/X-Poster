"use server";

import { auth } from "@clerk/nextjs/server";
import { getSupabaseClient } from "@/lib/supabase";
import { encrypt } from "@/lib/encryption";

type ExchangeResult = { ok: true; username: string } | { error: string };

export async function exchangeInstagramCode(
  code: string,
  callbackUrl: string
): Promise<ExchangeResult> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;
  const clientSecret = process.env.INSTAGRAM_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { error: "Instagram OAuth credentials are not configured on the server." };
  }

  try {
    // Step 1: Exchange auth code for short-lived user access token via FB dialog
    const shortTokenRes = await fetch("https://graph.facebook.com/v19.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        code,
      }),
    });

    if (!shortTokenRes.ok) {
      const body = await shortTokenRes.text();
      console.error("Instagram short-lived token error:", body);
      return { error: "Failed to exchange authorization code. Please try again." };
    }

    const shortTokenData = (await shortTokenRes.json()) as {
      access_token?: string;
      error?: { message: string };
    };

    if (!shortTokenData.access_token) {
      return {
        error: shortTokenData.error?.message ?? "No access token returned from Meta.",
      };
    }

    // Step 2: Exchange short-lived token for long-lived token (60-day expiry)
    const longTokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token",
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: shortTokenData.access_token,
        }),
      { method: "GET" }
    );

    if (!longTokenRes.ok) {
      const body = await longTokenRes.text();
      console.error("Instagram long-lived token error:", body);
      return { error: "Failed to exchange for long-lived token." };
    }

    const longTokenData = (await longTokenRes.json()) as {
      access_token?: string;
      error?: { message: string };
    };

    const accessToken = longTokenData.access_token ?? shortTokenData.access_token;

    // Step 3: Fetch Instagram account linked to this FB user
    // First get FB user's Instagram business accounts
    const igAccountRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?` +
        new URLSearchParams({ access_token: accessToken }),
      { method: "GET" }
    );

    let igUserId: string | null = null;
    let igUsername: string | null = null;

    if (igAccountRes.ok) {
      const accountData = (await igAccountRes.json()) as {
        data?: { id: string; instagram_business_account?: { id: string } }[];
      };
      // Try to find a page with linked Instagram account
      for (const page of accountData.data ?? []) {
        const pageToken = page.id;
        // Get Instagram business account for this page
        const igRes = await fetch(
          `https://graph.facebook.com/v19.0/${pageToken}?` +
            new URLSearchParams({
              fields: "instagram_business_account",
              access_token: accessToken,
            }),
          { method: "GET" }
        );
        if (igRes.ok) {
          const igData = (await igRes.json()) as {
            instagram_business_account?: { id: string };
          };
          if (igData.instagram_business_account?.id) {
            igUserId = igData.instagram_business_account.id;
            break;
          }
        }
      }
    }

    // Fallback: try direct IG user via /me with instagram scope
    if (!igUserId) {
      const meRes = await fetch(
        `https://graph.facebook.com/v19.0/me?` +
          new URLSearchParams({
            fields: "id,name",
            access_token: accessToken,
          }),
        { method: "GET" }
      );
      if (meRes.ok) {
        const meData = (await meRes.json()) as { id?: string; name?: string };
        igUserId = meData.id ?? null;
        igUsername = meData.name ?? null;
      }
    }

    // Fetch IG username if we have the IG user ID
    if (igUserId && !igUsername) {
      const igUserRes = await fetch(
        `https://graph.facebook.com/v19.0/${igUserId}?` +
          new URLSearchParams({
            fields: "id,username",
            access_token: accessToken,
          }),
        { method: "GET" }
      );
      if (igUserRes.ok) {
        const igUserData = (await igUserRes.json()) as {
          id?: string;
          username?: string;
        };
        igUsername = igUserData.username ?? null;
        if (!igUserId) igUserId = igUserData.id ?? null;
      }
    }

    if (!igUserId) {
      return {
        error:
          "Could not find an Instagram Business or Creator account linked to your Facebook account. Please ensure your Instagram account is connected to a Facebook Page.",
      };
    }

    // Save encrypted token + user ID to DB
    const supabase = getSupabaseClient();
    const encryptedToken = encrypt(accessToken);
    const { error: dbError } = await supabase
      .from("user_credentials")
      .upsert(
        {
          user_id: userId,
          instagram_access_token: encryptedToken,
          instagram_user_id: igUserId,
          instagram_username: igUsername,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      console.error("DB save error:", dbError);
      return { error: "Failed to save Instagram credentials." };
    }

    return { ok: true, username: igUsername ?? igUserId };
  } catch (err) {
    console.error("exchangeInstagramCode error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }
}

export async function disconnectInstagram(): Promise<{ ok: true } | { error: string }> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("user_credentials")
    .update({
      instagram_access_token: null,
      instagram_user_id: null,
      instagram_username: null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) return { error: "Failed to disconnect Instagram." };
  return { ok: true };
}
