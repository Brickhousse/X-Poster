"use server";

import { cookies } from "next/headers";
import { TwitterApi, EUploadMimeType, ApiResponseError } from "twitter-api-v2";
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
      if (!imgRes.ok) {
        return { error: `Could not fetch image (${imgRes.status}). The image URL may have expired — try regenerating.` };
      }
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
    if (err instanceof ApiResponseError) {
      const status = err.code;
      const detail = err.errors?.[0];
      const apiMessage = typeof detail === "object" && detail !== null && "message" in detail
        ? (detail as { message: string }).message
        : err.message;
      if (status === 401) {
        return { error: "Access token expired or revoked. Please reconnect your X account in Settings." };
      }
      if (status === 403) {
        return { error: `X rejected the request (403 Forbidden): ${apiMessage}. If this keeps happening, disconnect and reconnect your X account in Settings.` };
      }
      if (status === 429) {
        return { error: "Rate limit reached. Please wait a few minutes and try again." };
      }
      if (status === 400 || status === 422) {
        return { error: `X rejected the post: ${apiMessage}` };
      }
      return { error: `X API error ${status}: ${apiMessage}` };
    }
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("401") || message.toLowerCase().includes("unauthorized")) {
      return { error: "Access token expired or revoked. Please reconnect your X account in Settings." };
    }
    return { error: `Failed to post: ${message}` };
  }
}
