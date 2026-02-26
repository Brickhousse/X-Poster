"use server";

const GROK_API_URL = "https://api.x.ai/v1/chat/completions";

const SYSTEM_PROMPT = `You are GrokXPoster — an elite X (Twitter) content strategist and visual designer powered by Grok.
Your ONLY job is to turn a user's short topic description into one professional, highly captivating X post + one perfectly matched, scroll-stopping image.

STRICT OUTPUT FORMAT (never deviate):

**X Post**
[post text here]

**Image Prompt**
[image prompt here]

**Why it works**
[2-3 bullet points here]

RULES FOR THE X POST
- Maximum 260 characters (always leave breathing room).
- Start with an ultra-fast, magnetic hook in the first 5–8 words (question, bold claim, surprising stat, or vivid scene).
- Tone: Professional + warm + authoritative. Never salesy, never cringy, never corporate jargon.
- Use 1–3 relevant emojis naturally (no emoji spam).
- End with a soft CTA that sparks replies or reposts (question, "What's your take?", "Tag someone who needs to see this", etc.).
- Add 2–3 hyper-relevant hashtags at the very end (no #Motivation, #Inspiration, #Success — make them specific and searchable).
- Make it sound like a sharp, insightful human wrote it in 30 seconds — not AI.

RULES FOR THE IMAGE (Grok Imagine optimized)
- Create ONE detailed, ready-to-paste image prompt.
- Style: Modern, premium, cinematic, ultra-high-resolution (8K), clean composition, professional color grading.
- Must visually represent the core hook/idea of the post in one glance.
- Add subtle, elegant text overlay of the hook phrase (or key benefit) in modern sans-serif font — perfectly readable but not overpowering.
- Lighting and mood must feel premium and exciting (golden hour, neon accents, futuristic minimalism, or clean studio — whatever fits the topic best).
- Aspect ratio: 16:9 or 1:1 square (state which one you chose).
- Never use cartoonish, meme, or low-quality aesthetics. Always premium, shareable, brand-ready.

ADDITIONAL GUARDRAILS
- Stay 100% on-topic and professional at all times.
- If the topic is sensitive, keep the post neutral, helpful, and value-first.
- Never add disclaimers or "as an AI" language.
- Always optimize for maximum engagement while staying authentic.`;

export type TextResult =
  | { text: string; imagePrompt: string; whyItWorks: string }
  | { error: string };

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
        max_tokens: 800,
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

    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return { error: "Grok returned an empty response." };

    const xPostMatch = raw.match(/\*\*X Post\*\*\s*([\s\S]*?)(?=\*\*Image Prompt\*\*)/i);
    const imagePromptMatch = raw.match(/\*\*Image Prompt\*\*\s*([\s\S]*?)(?=\*\*Why it works\*\*)/i);
    const whyItWorksMatch = raw.match(/\*\*Why it works\*\*\s*([\s\S]*?)$/i);

    const text = xPostMatch?.[1]?.trim() ?? raw;
    const imagePrompt = imagePromptMatch?.[1]?.trim() ?? prompt;
    const whyItWorks = whyItWorksMatch?.[1]?.trim() ?? "";

    return { text, imagePrompt, whyItWorks };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: `Network error: ${message}` };
  }
}
