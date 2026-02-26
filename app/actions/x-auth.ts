"use server";

import { TwitterApi } from "twitter-api-v2";

type AuthUrlResult =
  | { url: string; codeVerifier: string; state: string }
  | { error: string };

export async function generateXAuthUrl(
  clientId: string,
  clientSecret: string,
  callbackUrl: string
): Promise<AuthUrlResult> {
  try {
    const client = new TwitterApi({ clientId, clientSecret });
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
      callbackUrl,
      { scope: ["tweet.read", "tweet.write", "users.read"] }
    );
    return { url, codeVerifier, state };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Failed to generate auth URL: ${message}` };
  }
}
