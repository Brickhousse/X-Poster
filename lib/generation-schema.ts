import { z } from "zod";

export const generateSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(10000, "Prompt must be 10,000 characters or fewer"),
});

export type GenerateFormValues = z.infer<typeof generateSchema>;
