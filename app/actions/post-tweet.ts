"use server";

import { cookies } from "next/headers";
import { TwitterApi } from "twitter-api-v2";
import { getIronSession } from "iron-session";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/session";

const schema = z.object({
  text: z.string().min(1).max(280),
});

type PostResult = { id: string; tweetUrl: string } | { error: string };

export async function postTweet(text: string): Promise<PostResult> {
  const parsed = schema.safeParse({ text });
  if (!parsed.success) {
    return { error: "Invalid tweet text." };
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.xAccessToken) {
    return { error: "X account not connected. Go to Settings to connect." };
  }

  try {
    const client = new TwitterApi(session.xAccessToken);
    const { data } = await client.v2.tweet(parsed.data.text);
    const tweetUrl = `https://x.com/i/web/status/${data.id}`;
    return { id: data.id, tweetUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      return { error: "401: Access token expired or revoked. Please reconnect your X account in Settings." };
    }
    return { error: "Failed to post tweet. Please try again." };
  }
}
