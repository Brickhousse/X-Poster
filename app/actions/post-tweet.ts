"use server";

import { cookies } from "next/headers";
import { TwitterApi, EUploadMimeType } from "twitter-api-v2";
import { getIronSession } from "iron-session";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/session";

const schema = z.object({
  text: z.string().min(1, "Post cannot be empty.").max(25000, "Post exceeds the maximum allowed length."),
  imageUrl: z.string().url().optional(),
});

type PostResult = { id: string; tweetUrl: string } | { error: string };

export async function postTweet(text: string, imageUrl?: string): Promise<PostResult> {
  const parsed = schema.safeParse({ text, imageUrl });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.xAccessToken) {
    return { error: "X account not connected. Go to Settings to connect." };
  }

  try {
    const client = new TwitterApi(session.xAccessToken);

    if (parsed.data.imageUrl) {
      const imgRes = await fetch(parsed.data.imageUrl);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const mimeType = (imgRes.headers.get("content-type")?.split(";")[0] ?? "image/jpeg") as EUploadMimeType;
      const mediaId = await client.v2.uploadMedia(buffer, { media_type: mimeType });
      const { data } = await client.v2.tweet({ text: parsed.data.text, media: { media_ids: [mediaId] } });
      const tweetUrl = `https://x.com/i/web/status/${data.id}`;
      return { id: data.id, tweetUrl };
    }

    const { data } = await client.v2.tweet(parsed.data.text);
    const tweetUrl = `https://x.com/i/web/status/${data.id}`;
    return { id: data.id, tweetUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      return { error: "Access token expired or revoked. Please reconnect your X account in Settings." };
    }
    return { error: "Failed to post. Please try again." };
  }
}
