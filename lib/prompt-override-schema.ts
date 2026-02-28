export interface PromptOverride {
  brandVoice?: string;
  textStyle?: {
    tone?: string;
    emojiUsage?: "sparingly" | "none" | "moderate";
    audience?: string;
    niche?: string;
    avoid?: string;
  };
  imageStyles?: {
    allowFaces?: boolean;
    image1?: { name?: string; description?: string };
    image2?: { name?: string; description?: string };
    image3?: { name?: string; description?: string };
  };
}

export const DEFAULT_IMAGE_DESCRIPTIONS = [
  "Cinematic photography feel, golden-hour/dramatic lighting, photorealistic textures, strong visual metaphor.",
  "Dreamlike painterly style, surreal scale, unexpected juxtapositions, otherworldly colors.",
  "Minimal high-contrast graphic design, bold typography as hero, 2–3 color palette, clean geometric shapes.",
] as const;

export const IMAGE_FORMAT_SPECS = [
  "16:9 aspect ratio, 8K ultra-detailed, premium quality",
  "1:1 square aspect ratio, 8K ultra-detailed, premium quality",
  "1:1 square aspect ratio, 8K ultra-detailed",
] as const;

export const DEFAULT_IMAGE_STYLE_NAMES = [
  "Cinematic / Symbolic",
  "Surreal / Abstract",
  "Bold Graphic / Typographic",
] as const;

/** Returns true if any override field differs from the system defaults. */
export function isNonDefaultOverride(override: PromptOverride | null | undefined): boolean {
  if (!override) return false;
  if (override.brandVoice?.trim()) return true;
  const ts = override.textStyle;
  if (ts) {
    if (ts.tone?.trim()) return true;
    if (ts.emojiUsage && ts.emojiUsage !== "sparingly") return true;
    if (ts.audience?.trim()) return true;
    if (ts.niche?.trim()) return true;
    if (ts.avoid?.trim()) return true;
  }
  const is = override.imageStyles;
  if (is) {
    if (is.allowFaces === true) return true;
    if (is.image1?.name?.trim() || is.image1?.description?.trim()) return true;
    if (is.image2?.name?.trim() || is.image2?.description?.trim()) return true;
    if (is.image3?.name?.trim() || is.image3?.description?.trim()) return true;
  }
  return false;
}
