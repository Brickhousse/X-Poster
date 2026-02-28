"use server";

import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { getSupabaseClient } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";
import type { PromptOverride } from "@/lib/prompt-override-schema";
import {
  DEFAULT_IMAGE_DESCRIPTIONS,
  DEFAULT_IMAGE_STYLE_NAMES,
  IMAGE_FORMAT_SPECS,
} from "@/lib/prompt-override-schema";

const GROK_API_URL = "https://api.x.ai/v1/responses";

function buildSystemPrompt(override?: PromptOverride | null): string {
  const allowFaces = override?.imageStyles?.allowFaces ?? false;
  const faceRule = allowFaces ? "" : " No realistic sharp-focus faces or people.";
  const facesSuffix = allowFaces ? "" : ", no realistic sharp-focus faces or people";

  // Resolve per-image style names and descriptions
  const imageSlots = [
    override?.imageStyles?.image1,
    override?.imageStyles?.image2,
    override?.imageStyles?.image3,
  ] as const;

  const styleNames = imageSlots.map(
    (slot, i) => slot?.name?.trim() || DEFAULT_IMAGE_STYLE_NAMES[i]
  );
  const styleDescs = imageSlots.map(
    (slot, i) => slot?.description?.trim() || DEFAULT_IMAGE_DESCRIPTIONS[i]
  );

  const imageStyleBlocks = [0, 1, 2]
    .map((i) => {
      const spec = `${IMAGE_FORMAT_SPECS[i]}${facesSuffix}.`;
      return `**Image Prompt ${i + 1} — ${styleNames[i]}**\n${styleDescs[i]} — ${spec}`;
    })
    .join("\n\n");

  // Build user preferences block (injected just before EXAMPLE)
  const prefLines: string[] = [];
  const ts = override?.textStyle;
  if (ts?.tone?.trim()) {
    prefLines.push(`- Tone: ${ts.tone.trim()}`);
  }
  if (ts?.emojiUsage && ts.emojiUsage !== "sparingly") {
    const emojiLabels: Record<string, string> = { none: "None", moderate: "Moderate (3–5)" };
    prefLines.push(`- Emoji usage: ${emojiLabels[ts.emojiUsage] ?? ts.emojiUsage}`);
  }
  if (ts?.audience?.trim()) prefLines.push(`- Target audience: ${ts.audience.trim()}`);
  if (ts?.niche?.trim()) prefLines.push(`- Industry/niche: ${ts.niche.trim()}`);
  if (ts?.avoid?.trim()) prefLines.push(`- Always avoid: ${ts.avoid.trim()}`);

  const userPrefsPart =
    prefLines.length > 0
      ? `USER PREFERENCES (apply to X Post only)\n${prefLines.join("\n")}\n\n`
      : "";
  const brandVoicePart = override?.brandVoice?.trim()
    ? `USER BRAND CONTEXT\n${override.brandVoice.trim()}\n\n`
    : "";
  const userBlock =
    userPrefsPart || brandVoicePart ? `${userPrefsPart}${brandVoicePart}` : "";

  return `You are GrokXPoster — an elite X content strategist and visual designer powered by Grok.
Your ONLY job: Turn a user's short topic description (1–2 sentences) into one professional, highly captivating X post + three scroll-stopping image prompts.

STRICT OUTPUT FORMAT (never deviate)
1. **X Post** (ready to copy to X)
2. **Image Prompt 1 — ${styleNames[0]}**
3. **Image Prompt 2 — ${styleNames[1]}**
4. **Image Prompt 3 — ${styleNames[2]}**
5. **Why it works** (2–3 short bullets)

RULES FOR THE X POST
- **CRITICAL Sources & Links**: Never use [[1]](url), numbered citations, footnotes or brackets. Mention sources naturally ("TechCrunch reports…", "according to the Council on Foreign Relations…"). Proactively add 1–2 clean full URLs when they add real credibility or engagement — place them inline within the body, naturally after the sentence they support. Never dump links at the bottom just before the hashtags. Max 2 links.
- Start with a magnetic hook in the first 5–8 words (bold claim, stat or vivid scene).
- Tone: Professional, warm, authoritative — natural, refined, human. Ban clichés, hype, exclamation overload and salesy language.
- Add depth: Weave in a relatable observation, small story or broader connection. Make it feel insightful and lived-in.
- Use 1–3 relevant emojis sparingly and naturally — never clustered at the end.
- End with a strong, insightful closing statement. No CTAs, questions, "tag/save/repost" or similar.
- **Hashtags are ALWAYS the very last line** — nothing comes after them. Format: 2–3 specific, searchable hashtags on a single line.

STRUCTURE & FORMATTING (non-negotiable)
- The hook (first line) ALWAYS stands alone — blank line immediately after it, before the next sentence.
- Separate each distinct paragraph or thought with a blank line. Maximum 3 sentences per block.
- The closing statement ALWAYS stands on its own line, separated from the body by a blank line above it.
- Hashtags are always the final line, separated from the closing by a blank line. Nothing comes after hashtags.
- Never produce a post as a single unbroken block of text. Every post must have at least 2 blank-line separations.
- Target: 3–5 content lines spread across 2–3 visual blocks (hook / body / close), then hashtags.

RULES FOR THE THREE IMAGE PROMPTS
All three must be detailed, ready-to-paste, premium (8K, modern, dramatic lighting), boldly symbolic/metaphorical, conceptually rich, and attention-grabbing.${faceRule} Add text overlay's for impact, only if value added, of the hook phrase. Never plain, generic or low-quality.

${imageStyleBlocks}

ADDITIONAL GUARDRAILS
- 100% on-topic, professional, neutral on sensitive subjects.
- Never add "as an AI" or disclaimers.
- Always sound like a thoughtful human expert wrote it in 30 seconds.

${userBlock}EXAMPLE (reference only)

User: "Benefits of cold plunges for entrepreneurs"

**X Post**
At 5 a.m. the ice water hits harder than any boardroom decision ❄️.

For the founders who've built real companies, that shock resets the nervous system
the same way a brutal market correction resets complacency — discomfort as a
feature, not a bug.

Stoic philosophers called it voluntary hardship. The science calls it hormesis.
Either way, it's the oldest performance edge there is.

#ColdPlunge #FounderRoutines #MentalEdge

**Image Prompt 1 — Cinematic / Symbolic**
Surreal premium 8K symbolic image of a massive block of ice dramatically cracking open to reveal a perfectly cut, glowing diamond inside, representing clarity emerging from discomfort, steam and frost particles floating in golden sunrise light, elegant city skyline silhouette in the distant background, subtle elegant white text overlay in clean sans-serif "Discipline in Discomfort" at top, highly conceptual and dramatic composition, cinematic lighting, ultra-detailed, shot on Sony A1, 16:9 aspect ratio

**Image Prompt 2 — Surreal / Abstract**
Surreal digital painting of an enormous translucent iceberg floating in a golden sky above clouds, a radiant warm light source pulsing from deep within the ice, abstract flowing energy streams in deep blue and gold cascading outward, dreamlike scale and atmosphere, painterly brushstroke textures, subtle text overlay "Forged in Discomfort" in elegant white sans-serif, conceptual and emotionally charged, 1:1 square aspect ratio

**Image Prompt 3 — Bold Graphic / Typographic**
Flat graphic design poster, stark navy blue background with a single large geometric ice crystal shape in white, bold oversized sans-serif typography in white reading "FORGED IN DISCOMFORT" centered, small accent line in electric blue beneath, ultra-minimal two-color palette (navy + white with blue accent), clean Swiss design aesthetic, no photorealism, 1:1 square aspect ratio

**Why it works**
• Strong sensory hook with natural depth and historical tie-in
• Clean, human tone with single well-placed emoji
• Three varied, high-impact image styles

Now wait for the user's topic and deliver the five-section response exactly as specified.`;
}

const schema = z.object({
  prompt: z.string().min(1).max(10000),
});

export type TextResult =
  | { text: string; imagePrompts: [string, string, string]; whyItWorks: string }
  | { error: string };

export async function generateText(
  prompt: string,
  noveltyMode?: boolean,
  inSessionDraft?: { text: string; prompt: string },
): Promise<TextResult> {
  const parsed = schema.safeParse({ prompt });
  if (!parsed.success) {
    return { error: "Invalid prompt." };
  }

  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const supabase = getSupabaseClient();

  // Fetch credentials and settings in parallel
  const [credsResult, settingsResult] = await Promise.all([
    supabase
      .from("user_credentials")
      .select("grok_api_key")
      .eq("user_id", userId)
      .single(),
    supabase
      .from("user_settings")
      .select("prompt_override")
      .eq("user_id", userId)
      .single(),
  ]);

  const { data: creds } = credsResult;
  if (!creds?.grok_api_key) {
    return { error: "Grok API key not set. Go to Settings to add it." };
  }

  const grokApiKey = decrypt(creds.grok_api_key as string);
  const promptOverride =
    (settingsResult.data?.prompt_override as PromptOverride | null) ?? null;

  const systemPrompt = buildSystemPrompt(promptOverride);

  let userMessage = parsed.data.prompt;

  if (noveltyMode) {
    const exclusions: { prompt: string | null; text: string | null }[] = [];

    // Always include the current in-session draft first (DB-independent)
    if (inSessionDraft?.text) {
      exclusions.push({ prompt: inSessionDraft.prompt, text: inSessionDraft.text });
    }

    // Then append DB history (last 15)
    const { data: recentRows } = await supabase
      .from("posts")
      .select("prompt, edited_text")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(15);

    const dbPosts = (recentRows ?? [])
      .map((r) => {
        const row = r as Record<string, unknown>;
        return {
          prompt: row.prompt as string | null,
          text: row.edited_text as string | null,
        };
      })
      .filter((r) => r.prompt || r.text);

    exclusions.push(...dbPosts);

    if (exclusions.length > 0) {
      const list = exclusions
        .map((r) => {
          const hook = r.text ? r.text.split("\n")[0].slice(0, 120) : null;
          return hook
            ? `- Topic: "${r.prompt}" → Hook: "${hook}"`
            : `- Topic: "${r.prompt}"`;
        })
        .join("\n");
      userMessage =
        `Topic: ${parsed.data.prompt}\n\n` +
        `[NOVELTY DIRECTIVE — internal context only, do not mention in your response]\n` +
        `The user has already posted content with these angles. You MUST pick a distinctly ` +
        `different angle, hook, and framing that does NOT overlap with any of the following:\n` +
        `${list}\n` +
        `[END NOVELTY DIRECTIVE]`;
    }
  }

  try {
    const res = await fetch(GROK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${grokApiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4-1-fast-reasoning",
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        tools: [{ type: "web_search" }],
        max_output_tokens: 1200,
      }),
    });

    if (!res.ok) {
      if (res.status === 401) return { error: "Grok API key is invalid or expired." };
      if (res.status === 429) return { error: "Grok API rate limit reached. Please try again later." };
      let detail = "";
      try {
        const raw = await res.text();
        console.error("Grok API error body:", raw);
        try { const body = JSON.parse(raw); detail = body?.error?.message ?? body?.message ?? raw; } catch { detail = raw; }
      } catch {}
      return { error: `Grok API error ${res.status}${detail ? `: ${detail}` : ""}. Please try again.` };
    }

    const data = (await res.json()) as {
      output: { type: string; content: { type: string; text: string }[] }[];
    };

    const messageOutput = data.output?.find((o) => o.type === "message");
    const raw = messageOutput?.content?.find((c) => c.type === "output_text")?.text?.trim();
    if (!raw) return { error: "Grok returned an empty response." };

    const xPostMatch = raw.match(/\*\*X Post\*\*\s*([\s\S]*?)(?=\*\*Image Prompt 1)/i);
    const imagePrompt1Match = raw.match(/\*\*Image Prompt 1[^*]*\*\*\s*([\s\S]*?)(?=\*\*Image Prompt 2)/i);
    const imagePrompt2Match = raw.match(/\*\*Image Prompt 2[^*]*\*\*\s*([\s\S]*?)(?=\*\*Image Prompt 3)/i);
    const imagePrompt3Match = raw.match(/\*\*Image Prompt 3[^*]*\*\*\s*([\s\S]*?)(?=\*\*Why it works\*\*)/i);
    const whyItWorksMatch = raw.match(/\*\*Why it works\*\*\s*([\s\S]*?)$/i);

    const text = xPostMatch?.[1]?.trim() ?? raw;
    const prompt1 = imagePrompt1Match?.[1]?.trim() ?? text;
    const prompt2 = imagePrompt2Match?.[1]?.trim() ?? text;
    const prompt3 = imagePrompt3Match?.[1]?.trim() ?? text;
    const whyItWorks = whyItWorksMatch?.[1]?.trim() ?? "";

    return { text, imagePrompts: [prompt1, prompt2, prompt3], whyItWorks };
  } catch {
    return { error: "Network error. Please check your connection and try again." };
  }
}
