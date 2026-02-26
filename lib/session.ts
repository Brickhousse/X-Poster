import type { SessionOptions } from "iron-session";

export interface SessionData {
  xAccessToken?: string;
  grokApiKey?: string;
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "xposter_session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  },
};
