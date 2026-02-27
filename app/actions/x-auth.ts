"use server";

import { TwitterApi } from "twitter-api-v2";

type AuthUrlResult =
  | { url: string; codeVerifier: string; state: string }
  | { error: string };

export async function generateXAuthUrl(callbackUrl: string): Promise<AuthUrlResult> {
  const clientId = process.env.NEXT_PUBLIC_X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return { error: "X OAuth credentials are not configured on the server." };
  }

  try {
    const client = new TwitterApi({ clientId, clientSecret });
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(callbackUrl, {
      scope: ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"],
    });
    return { url, codeVerifier, state };
  } catch {
    return { error: "Failed to generate auth URL." };
  }
}
