"use server";

import { auth } from "@clerk/nextjs/server";
import { TwitterApi, EUploadMimeType, ApiResponseError } from "twitter-api-v2";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";

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

  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const supabase = getSupabaseClient();
  const { data: creds } = await supabase
    .from("user_credentials")
    .select("x_access_token")
    .eq("user_id", userId)
    .single();

  if (!creds?.x_access_token) {
    return { error: "X account not connected. Go to Settings to connect." };
  }

  const xAccessToken = decrypt(creds.x_access_token as string);

  // URLs that cannot be uploaded as media (X embeds, platform.twitter.com iframes)
  const isNonUploadableUrl = (url: string) =>
    /^https?:\/\/(twitter\.com|x\.com)\/(i\/status|[^/?#]+\/status)\/\d+/i.test(url) ||
    url.startsWith("https://platform.twitter.com/");

  const X_ALLOWED_MIME_TYPES = new Set([
    "video/mp4", "video/webm", "video/mp2t", "video/quicktime",
    "text/srt", "text/vtt",
    "image/jpeg", "image/gif", "image/bmp", "image/png", "image/webp", "image/pjpeg", "image/tiff",
    "model/gltf-binary", "model/vnd.usdz+zip",
  ]);

  const EXT_TO_MIME: Record<string, string> = {
    ".mp4": "video/mp4", ".webm": "video/webm", ".ts": "video/mp2t", ".mov": "video/quicktime",
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
    ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp",
  };

  const resolveMimeType = (contentType: string | null, url: string): string | null => {
    const ct = contentType?.split(";")[0].trim().toLowerCase() ?? "";
    if (ct && ct !== "application/octet-stream" && X_ALLOWED_MIME_TYPES.has(ct)) return ct;
    const extMatch = url.match(/\.(\w+)(?:\?|$)/);
    const fromExt = extMatch ? EXT_TO_MIME[`.${extMatch[1].toLowerCase()}`] : null;
    return fromExt ?? null;
  };

  try {
    const client = new TwitterApi(xAccessToken);

    if (parsed.data.imageUrl && !isNonUploadableUrl(parsed.data.imageUrl)) {
      const imgRes = await fetch(parsed.data.imageUrl);
      if (!imgRes.ok) {
        return { error: `Could not fetch media (${imgRes.status}). The URL may have expired — try regenerating.` };
      }
      const mimeType = resolveMimeType(imgRes.headers.get("content-type"), parsed.data.imageUrl);
      if (!mimeType) {
        const ct = imgRes.headers.get("content-type")?.split(";")[0] ?? "unknown";
        return { error: `Unsupported media type "${ct}". X accepts: JPEG, PNG, GIF, WebP, MP4, WebM, MOV.` };
      }
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const mediaId = await client.v2.uploadMedia(buffer, { media_type: mimeType as EUploadMimeType });
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
