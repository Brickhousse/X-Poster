"use server";

const GROK_API_URL = "https://api.x.ai/v1/chat/completions";

const SYSTEM_PROMPT = `You are an expert social media writer specialising in X (Twitter) posts.
Given a topic or idea, write ONE punchy, engaging post.
Rules:
- Maximum 280 characters (strictly enforced)
- Conversational and direct — write like a human, not a marketer
- No more than one hashtag; prefer zero
- No emojis unless they add clear value
- Output ONLY the post text — no quotes, no labels, no explanation`;

type TextResult = { text: string } | { error: string };

export async function generateText(
  prompt: string,
  apiKey: string
): Promise<TextResult> {
  try {
    const res = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        max_tokens: 120,
        temperature: 0.8,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { error: `Grok API error ${res.status}: ${body}` };
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
    };

    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) return { error: "Grok returned an empty response." };

    return { text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Network error: ${message}` };
  }
}
