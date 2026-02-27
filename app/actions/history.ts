"use server";

import { auth } from "@clerk/nextjs/server";
import { getSupabaseClient } from "@/lib/supabase";
import { uploadImageFromUrl, deleteStorageImages } from "@/lib/image-storage";
import type { HistoryItem } from "@/lib/history-schema";

type AddInput = Omit<HistoryItem, "id"> & { allImageUrls?: string[] };
type AddResult = { id: string; storageUrls: string[] } | { error: string };
type MutateResult = { ok: true } | { error: string };

const HISTORY_LIMIT = 15;

function dbRowToHistoryItem(row: Record<string, unknown>): HistoryItem {
  return {
    id: row.id as string,
    prompt: row.prompt as string,
    imagePrompt: (row.image_prompt as string | null) ?? undefined,
    editedText: row.edited_text as string,
    imageUrl: (row.image_url as string | null) ?? null,
    imageUrls: (row.image_urls as string[] | null) ?? undefined,
    status: row.status as HistoryItem["status"],
    createdAt: row.created_at as string,
    tweetUrl: (row.tweet_url as string | null) ?? undefined,
    postedAt: (row.posted_at as string | null) ?? undefined,
    scheduledFor: (row.scheduled_for as string | null) ?? undefined,
    pinned: (row.pinned as boolean | null) ?? false,
  };
}

export async function addHistoryItem(item: AddInput): Promise<AddResult> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  // Upload all provided Grok URLs to Storage in parallel
  const storageUrls: string[] = [];
  if (item.allImageUrls && item.allImageUrls.length > 0) {
    const results = await Promise.all(
      item.allImageUrls.map((u) => uploadImageFromUrl(u, userId))
    );
    storageUrls.push(...results.filter((u): u is string => u !== null));
  }

  // Use first Storage URL as canonical image_url (overrides ephemeral Grok URL)
  const canonicalImageUrl = storageUrls[0] ?? item.imageUrl ?? null;

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      user_id: userId,
      prompt: item.prompt,
      image_prompt: item.imagePrompt ?? null,
      edited_text: item.editedText,
      image_url: canonicalImageUrl,
      image_urls: storageUrls,
      status: item.status,
      tweet_url: item.tweetUrl ?? null,
      posted_at: item.postedAt ?? null,
      scheduled_for: item.scheduledFor ?? null,
      created_at: item.createdAt,
    })
    .select("id")
    .single();

  if (error || !data) return { error: "Failed to save history item." };

  // Auto-trim: keep only the most recent HISTORY_LIMIT non-pinned items
  const { data: nonPinned } = await supabase
    .from("posts")
    .select("id, image_urls")
    .eq("user_id", userId)
    .eq("pinned", false)
    .order("created_at", { ascending: false });

  if (nonPinned && nonPinned.length > HISTORY_LIMIT) {
    const toDelete = nonPinned.slice(HISTORY_LIMIT) as Record<string, unknown>[];
    const idsToDelete = toDelete.map((r) => r.id);
    // Delete Storage files for trimmed items
    for (const row of toDelete) {
      const urls = row.image_urls as string[] | null;
      if (urls?.length) await deleteStorageImages(urls);
    }
    await supabase
      .from("posts")
      .delete()
      .in("id", idsToDelete)
      .eq("user_id", userId);
  }

  return { id: data.id as string, storageUrls };
}

export async function updateHistoryItem(
  id: string,
  patch: Partial<Omit<HistoryItem, "id">>
): Promise<MutateResult> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.editedText !== undefined) updateData.edited_text = patch.editedText;
  if (patch.status !== undefined) updateData.status = patch.status;
  if (patch.tweetUrl !== undefined) updateData.tweet_url = patch.tweetUrl;
  if (patch.postedAt !== undefined) updateData.posted_at = patch.postedAt;
  if (patch.scheduledFor !== undefined) updateData.scheduled_for = patch.scheduledFor;
  if (patch.imageUrl !== undefined) updateData.image_url = patch.imageUrl;
  if (patch.imagePrompt !== undefined) updateData.image_prompt = patch.imagePrompt;
  if (patch.pinned !== undefined) updateData.pinned = patch.pinned;

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("posts")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: "Failed to update history item." };
  return { ok: true };
}

export async function deleteHistoryItem(id: string): Promise<MutateResult> {
  const { userId } = await auth();
  if (!userId) return { error: "Not authenticated." };

  const supabase = getSupabaseClient();

  // Fetch image_urls before deletion so we can clean up Storage
  const { data: row } = await supabase
    .from("posts")
    .select("image_urls")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  const imageUrls = (row as Record<string, unknown> | null)?.image_urls as string[] | null;
  if (imageUrls?.length) await deleteStorageImages(imageUrls);

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);

  if (error) return { error: "Failed to delete history item." };
  return { ok: true };
}

export async function getHistory(): Promise<HistoryItem[]> {
  const { userId } = await auth();
  if (!userId) return [];

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("posts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => dbRowToHistoryItem(row as Record<string, unknown>));
}
