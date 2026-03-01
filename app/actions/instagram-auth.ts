"use server";

type AuthUrlResult =
  | { url: string; state: string }
  | { error: string };

export async function generateInstagramAuthUrl(callbackUrl: string): Promise<AuthUrlResult> {
  const clientId = process.env.NEXT_PUBLIC_INSTAGRAM_CLIENT_ID;

  if (!clientId) {
    return { error: "Instagram OAuth credentials are not configured on the server." };
  }

  try {
    // Generate a random state for CSRF protection
    const state = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: "instagram_basic,instagram_content_publish",
      response_type: "code",
      state,
    });

    const url = `https://www.facebook.com/dialog/oauth?${params.toString()}`;
    return { url, state };
  } catch {
    return { error: "Failed to generate Instagram auth URL." };
  }
}
