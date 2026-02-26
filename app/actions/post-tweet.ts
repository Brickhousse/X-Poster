"use server";

import { TwitterApi } from "twitter-api-v2";

type PostResult = { id: string; tweetUrl: string } | { error: string };

export async function postTweet(
  text: string,
  accessToken: string
): Promise<PostResult> {
  try {
    const client = new TwitterApi(accessToken);
    const { data } = await client.v2.tweet(text);
    const tweetUrl = `https://x.com/i/web/status/${data.id}`;
    return { id: data.id, tweetUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      return { error: "401: Access token expired or revoked. Please reconnect your X account in Settings." };
    }
    return { error: `Failed to post: ${message}` };
  }
}
