"use server";

const GROK_IMAGE_URL = "https://api.x.ai/v1/images/generations";

type ImageResult = { url: string } | { error: string };

export async function generateImage(
  prompt: string,
  apiKey: string
): Promise<ImageResult> {
  try {
    const res = await fetch(GROK_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-imagine-image-pro",
        prompt,
        n: 1,
        response_format: "url",
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { error: `Grok Imagine error ${res.status}: ${body}` };
    }

    const data = (await res.json()) as {
      data: { url?: string; b64_json?: string }[];
    };

    const url = data.data?.[0]?.url;
    if (!url) return { error: "Grok Imagine returned no image URL." };

    return { url };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Network error: ${message}` };
  }
}
