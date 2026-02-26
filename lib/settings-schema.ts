import { z } from "zod";

export const settingsSchema = z.object({
  grokApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  xClientId: z.string().optional(),
  xClientSecret: z.string().optional(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
