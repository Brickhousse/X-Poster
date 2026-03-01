import type { PromptOverride } from "@/lib/prompt-override-schema";

export type HistoryItemStatus = "draft" | "posted" | "scheduled";
export type HistoryItemPlatform = "x" | "instagram";

export interface HistoryItem {
  id: string;
  prompt: string;
  imagePrompt?: string;
  editedText: string;
  imageUrl: string | null;
  status: HistoryItemStatus;
  createdAt: string; // ISO 8601
  tweetUrl?: string; // also used for instagram post URL
  postedAt?: string; // ISO 8601
  scheduledFor?: string; // ISO 8601
  pinned?: boolean; // undefined = false (legacy rows before column existed)
  imageUrls?: string[]; // all Storage URLs (up to 3); may be absent for legacy rows
  promptOverride?: PromptOverride | null; // snapshot of override used at generation time
  platform?: HistoryItemPlatform; // undefined = "x" for legacy rows
}
