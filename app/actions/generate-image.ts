"use server";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/session";

const GROK_IMAGE_URL = "https://api.x.ai/v1/images/generations";

const schema = z.object({
  prompt: z.string().min(1).max(1000),
});

type ImageResult = { url: string } | { error: string };

export async function generateImage(prompt: string): Promise<ImageResult> {
  const parsed = schema.safeParse({ prompt });
  if (!parsed.success) {
    return { error: "Invalid image prompt." };
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  if (!session.grokApiKey) {
    return { error: "Grok API key not set. Go to Settings to add it." };
  }

  try {
    const res = await fetch(GROK_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.grokApiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image-pro",
        prompt: parsed.data.prompt,
        n: 1,
        response_format: "url",
      }),
    });

    if (!res.ok) {
      if (res.status === 401) return { error: "Grok API key is invalid or expired." };
      if (res.status === 429) return { error: "Grok API rate limit reached. Please try again later." };
      return { error: `Grok Imagine error ${res.status}. Please try again.` };
    }

    const data = (await res.json()) as {
      data: { url?: string; b64_json?: string }[];
    };

    const url = data.data?.[0]?.url;
    if (!url) return { error: "Grok Imagine returned no image URL." };

    return { url };
  } catch {
    return { error: "Network error. Please check your connection and try again." };
  }
}
