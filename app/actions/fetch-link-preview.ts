"use server";
import { z } from "zod";

const schema = z.object({ url: z.string().url() });

export async function fetchLinkPreview(
  url: string
): Promise<{ imageUrl: string | null; videoUrl: string | null } | { error: string }> {
  const parsed = schema.safeParse({ url });
  if (!parsed.success) return { error: "Invalid URL" };

  // X/Twitter post URLs auto-embed when included in a tweet — no need to scrape
  const xPostPattern = /^https?:\/\/(twitter\.com|x\.com)\/(i\/status|[^/?#]+\/status)\/\d+/i;
  if (xPostPattern.test(parsed.data.url)) {
    return { imageUrl: null, videoUrl: parsed.data.url };
  }

  try {
    const res = await fetch(parsed.data.url, {
      headers: { "User-Agent": "Twitterbot/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const html = await res.text();

    // Try both attribute orders for og:image
    const imageMatch =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const imageUrl = imageMatch?.[1]
      ? (imageMatch[1].startsWith("http") ? imageMatch[1] : new URL(imageMatch[1], parsed.data.url).href)
      : null;

    // Try both attribute orders for og:video:url and og:video
    const videoMatch =
      html.match(/<meta[^>]+property=["']og:video:url["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video:url["']/i) ??
      html.match(/<meta[^>]+property=["']og:video["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video["']/i);

    const videoTypeMatch =
      html.match(/<meta[^>]+property=["']og:video:type["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:video:type["']/i);

    const rawVideoUrl = videoMatch?.[1];
    const videoType = videoTypeMatch?.[1] ?? "";
    const isDirectVideo =
      videoType.startsWith("video/") ||
      (!videoType && !!rawVideoUrl && /\.(mp4|webm|ogg|mov)(\?|$)/i.test(rawVideoUrl));

    const videoUrl = isDirectVideo && rawVideoUrl
      ? (rawVideoUrl.startsWith("http") ? rawVideoUrl : new URL(rawVideoUrl, parsed.data.url).href)
      : null;

    if (!imageUrl && !videoUrl) return { error: "No preview media found" };
    return { imageUrl, videoUrl };
  } catch {
    return { error: "Failed to fetch link preview" };
  }
}
