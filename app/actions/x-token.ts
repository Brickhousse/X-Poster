"use server";

import { TwitterApi } from "twitter-api-v2";

type TokenResult = { accessToken: string } | { error: string };

export async function exchangeXCode(
  code: string,
  codeVerifier: string,
  clientId: string,
  clientSecret: string,
  callbackUrl: string
): Promise<TokenResult> {
  try {
    const client = new TwitterApi({ clientId, clientSecret });
    const { accessToken } = await client.loginWithOAuth2({
      code,
      codeVerifier,
      redirectUri: callbackUrl,
    });
    return { accessToken };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Token exchange failed: ${message}` };
  }
}
