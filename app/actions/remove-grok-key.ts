"use server";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export async function removeGrokKey(): Promise<{ ok: true }> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  session.grokApiKey = undefined;
  await session.save();
  return { ok: true };
}
