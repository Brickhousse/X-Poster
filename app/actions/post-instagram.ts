"use server";

import { auth } from "@clerk/nextjs/server";
import { getSupabaseClient } from "@/lib/supabase";
import { decrypt } from "@/lib/encryption";
import { uploadImageFromUrl } from "@/lib/image-storage";

type PostResult =
  | { mediaId: string; postUrl: string }
  | { error: string };

const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 10;

export async function postInstagram(
  caption: string,
  imageUrl: string
): Promise<PostResult> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const supabase = getSupabaseClient();
  const { data: creds } = await supabase
    .from("user_credentials")
    .select("instagram_access_token, instagram_user_id")
    .eq("user_id", userId)
    .single();

  if (!creds?.instagram_access_token || !creds?.instagram_user_id) {
    return {
      error: "Instagram account not connected. Go to Settings to connect your Instagram account.",
    };
  }

  let accessToken: string;
  try {
    accessToken = decrypt(creds.instagram_access_token as string);
  } catch {
    return { error: "Failed to decrypt Instagram credentials. Please reconnect in Settings." };
  }

  const igUserId = creds.instagram_user_id as string;

  // Ensure we have a publicly accessible image URL (upload to Supabase Storage if needed)
  const supabaseBase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let publicImageUrl = imageUrl;
  if (!imageUrl.startsWith(supabaseBase + "/storage/")) {
    const uploaded = await uploadImageFromUrl(imageUrl, userId);
    if (uploaded) {
      publicImageUrl = uploaded;
    }
    // If upload fails, try the original URL — Meta will attempt to fetch it
  }

  try {
    // Step 1: Create media container
    const createRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          image_url: publicImageUrl,
          caption,
          access_token: accessToken,
        }),
      }
    );

    if (!createRes.ok) {
      const body = await createRes.text();
      console.error("Instagram create container error:", body);
      let message = `Instagram API error (${createRes.status})`;
      try {
        const parsed = JSON.parse(body) as { error?: { message: string; code: number } };
        if (parsed.error?.message) {
          message = parsed.error.message;
          // Common error codes
          if (parsed.error.code === 36000) {
            message = "Instagram Business/Creator account required. Personal accounts cannot publish via API.";
          }
        }
      } catch {}
      return { error: message };
    }

    const createData = (await createRes.json()) as { id?: string; error?: { message: string } };
    if (!createData.id) {
      return { error: createData.error?.message ?? "No container ID returned from Instagram." };
    }
    const containerId = createData.id;

    // Step 2: Poll until container is FINISHED
    let attempts = 0;
    while (attempts < MAX_POLLS) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      attempts++;

      const statusRes = await fetch(
        `https://graph.facebook.com/v19.0/${containerId}?` +
          new URLSearchParams({
            fields: "status_code",
            access_token: accessToken,
          }),
        { method: "GET" }
      );

      if (!statusRes.ok) continue;

      const statusData = (await statusRes.json()) as { status_code?: string };
      if (statusData.status_code === "FINISHED") break;
      if (statusData.status_code === "ERROR") {
        return { error: "Instagram media processing failed. Try a different image." };
      }
    }

    // Step 3: Publish the container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          creation_id: containerId,
          access_token: accessToken,
        }),
      }
    );

    if (!publishRes.ok) {
      const body = await publishRes.text();
      console.error("Instagram publish error:", body);
      let message = `Instagram publish error (${publishRes.status})`;
      try {
        const parsed = JSON.parse(body) as { error?: { message: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {}
      return { error: message };
    }

    const publishData = (await publishRes.json()) as { id?: string; error?: { message: string } };
    if (!publishData.id) {
      return { error: publishData.error?.message ?? "No media ID returned from Instagram." };
    }

    const mediaId = publishData.id;
    // We can't get the shortcode easily without another API call, so return the profile URL
    const postUrl = `https://www.instagram.com/`;

    return { mediaId, postUrl };
  } catch (err) {
    console.error("postInstagram error:", err);
    return { error: "Network error posting to Instagram. Please try again." };
  }
}
