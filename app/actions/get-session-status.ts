"use server";

import { cookies } from "next/headers";
import { getIronSession } from "iron-session";
import { sessionOptions, type SessionData } from "@/lib/session";

export interface SessionStatus {
  hasGrokKey: boolean;
  hasXToken: boolean;
}

export async function getSessionStatus(): Promise<SessionStatus> {
  const session = await getIronSession<SessionData>(await cookies(), sessionOptions);
  return {
    hasGrokKey: !!session.grokApiKey,
    hasXToken: !!session.xAccessToken,
  };
}
