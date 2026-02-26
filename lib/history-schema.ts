export type HistoryItemStatus = "draft" | "posted" | "scheduled";

export interface HistoryItem {
  id: string;
  prompt: string;
  imagePrompt?: string;
  editedText: string;
  imageUrl: string | null;
  status: HistoryItemStatus;
  createdAt: string; // ISO 8601
  tweetUrl?: string;
  postedAt?: string; // ISO 8601
  scheduledFor?: string; // ISO 8601
}
