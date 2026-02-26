import { z } from "zod";

export const generateSchema = z.object({
  prompt: z
    .string()
    .min(1, "Prompt is required")
    .max(500, "Prompt must be 500 characters or fewer"),
});

export type GenerateFormValues = z.infer<typeof generateSchema>;
