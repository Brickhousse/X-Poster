"use server";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { z } from "zod";
import { sessionOptions, type SessionData } from "@/lib/session";

const schema = z.object({
  grokApiKey: z.string().min(1, "API key is required").max(200),
});

type SaveGrokKeyResult = { ok: true } | { error: string };

export async function saveGrokKey(grokApiKey: string): Promise<SaveGrokKeyResult> {
  const parsed = schema.safeParse({ grokApiKey });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.grokApiKey = parsed.data.grokApiKey;
  await session.save();
  return { ok: true };
}
