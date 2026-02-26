"use server";
import { z } from "zod";

const schema = z.object({ url: z.string().url() });

export async function fetchLinkPreview(url: string): Promise<{ imageUrl: string } | { error: string }> {
  const parsed = schema.safeParse({ url });
  if (!parsed.success) return { error: "Invalid URL" };
  try {
    const res = await fetch(parsed.data.url, {
      headers: { "User-Agent": "Twitterbot/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    const html = await res.text();
    // Try both attribute orders for og:image
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    if (!match?.[1]) return { error: "No preview image found" };
    // Resolve relative URLs
    const imageUrl = match[1].startsWith("http") ? match[1] : new URL(match[1], parsed.data.url).href;
    return { imageUrl };
  } catch {
    return { error: "Failed to fetch link preview" };
  }
}
