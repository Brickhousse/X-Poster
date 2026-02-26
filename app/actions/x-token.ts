"use server";

import { cookies } from "next/headers";
import { TwitterApi } from "twitter-api-v2";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

type TokenResult = { ok: true } | { error: string };

export async function exchangeXCode(
  code: string,
  codeVerifier: string,
  callbackUrl: string
): Promise<TokenResult> {
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

    const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
    session.xAccessToken = accessToken;
    await session.save();

    return { ok: true };
  } catch {
    return { error: "Token exchange failed. Please try connecting again." };
  }
}
