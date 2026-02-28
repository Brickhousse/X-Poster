import { z } from "zod";

export const settingsSchema = z.object({
  openaiApiKey: z.string().optional(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;

const textStyleSchema = z.object({
  tone: z.string().max(200).optional(),
  emojiUsage: z.enum(["sparingly", "none", "moderate"]).optional(),
  audience: z.string().max(200).optional(),
  niche: z.string().max(200).optional(),
  avoid: z.string().max(300).optional(),
}).optional();

const imageSlotSchema = z.object({
  name: z.string().max(100).optional(),
  description: z.string().max(1000).optional(),
}).optional();

export const promptOverrideSchema = z.object({
  brandVoice: z.string().max(1000).optional(),
  textStyle: textStyleSchema,
  imageStyles: z.object({
    allowFaces: z.boolean().optional(),
    image1: imageSlotSchema,
    image2: imageSlotSchema,
    image3: imageSlotSchema,
  }).optional(),
}).nullable();

export type PromptOverrideFormValues = z.infer<typeof promptOverrideSchema>;
