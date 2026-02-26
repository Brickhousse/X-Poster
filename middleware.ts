import { NextRequest, NextResponse } from "next/server";

// In-memory rate limiter: 30 server action POSTs per minute per IP.
// For production with multiple instances, replace with Upstash Redis:
// https://upstash.com/docs/redis/sdks/ratelimit-ts/overview
const ipMap = new Map<string, { count: number; resetAt: number }>();

const LIMIT = 30;
const WINDOW_MS = 60 * 1000; // 1 minute

function isServerActionPost(req: NextRequest): boolean {
  return (
    req.method === "POST" &&
    (req.headers.get("next-action") !== null ||
      req.headers.get("content-type")?.includes("multipart/form-data") === true)
  );
}

export function middleware(req: NextRequest) {
  if (!isServerActionPost(req)) return NextResponse.next();

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const entry = ipMap.get(ip);

  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return NextResponse.next();
  }

  if (entry.count >= LIMIT) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": String(Math.ceil((entry.resetAt - now) / 1000)),
      },
    });
  }

  entry.count++;
  return NextResponse.next();
}

export const config = {
  matcher: "/:path*",
};
