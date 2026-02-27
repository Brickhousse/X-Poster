"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";

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

  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const supabase = getSupabaseClient();
  const { data: creds } = await supabase
    .from("user_credentials")
    .select("grok_api_key")
    .eq("user_id", userId)
    .single();

  if (!creds?.grok_api_key) {
    return { error: "Grok API key not set. Go to Settings to add it." };
  }

  const grokApiKey = decrypt(creds.grok_api_key as string);

  try {
    const res = await fetch(GROK_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${grokApiKey}`,
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
