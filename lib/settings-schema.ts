import { z } from "zod";

export const settingsSchema = z.object({
  grokApiKey: z.string().min(1, "Grok API key is required"),
  openaiApiKey: z.string().optional(),
  xClientId: z.string().min(1, "X Client ID is required"),
  xClientSecret: z.string().min(1, "X Client Secret is required"),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
