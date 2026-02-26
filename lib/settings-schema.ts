import { z } from "zod";

export const settingsSchema = z.object({
  openaiApiKey: z.string().optional(),
});

export type SettingsFormValues = z.infer<typeof settingsSchema>;
