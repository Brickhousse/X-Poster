import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isProtectedRoute = createRouteMatcher([
  "/generate(.*)",
  "/history(.*)",
  "/settings(.*)",
]);

// In-memory rate limiter: 30 server action POSTs per minute per IP.
const ipMap = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 30;
const WINDOW_MS = 60 * 1000;

function checkRateLimit(req: NextRequest): NextResponse | null {
  const isServerActionPost =
    req.method === "POST" &&
    (req.headers.get("next-action") !== null ||
      req.headers.get("content-type")?.includes("multipart/form-data") === true);

  if (!isServerActionPost) return null;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const entry = ipMap.get(ip);

  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return null;
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
  return null;
}

export default clerkMiddleware(async (auth, req) => {
  const rateLimited = checkRateLimit(req);
  if (rateLimited) return rateLimited;
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
