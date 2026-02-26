"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, ExternalLink, RefreshCw, Loader2 } from "lucide-react";
import { loadHistory, deleteHistoryItem, updateHistoryItem } from "@/lib/history-storage";
import { postTweet } from "@/app/actions/post-tweet";
import type { HistoryItem, HistoryItemStatus } from "@/lib/history-schema";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const STATUS_STYLES: Record<HistoryItemStatus, string> = {
  draft: "bg-slate-700 text-slate-300",
  posted: "bg-green-900/60 text-green-400",
  scheduled: "bg-amber-900/60 text-amber-400",
};

function isOverdue(item: HistoryItem): boolean {
  return (
    item.status === "scheduled" &&
    !!item.scheduledFor &&
    new Date(item.scheduledFor) <= new Date()
  );
}

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postErrors, setPostErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setItems(loadHistory());
  }, []);

  const handlePostNow = async (item: HistoryItem) => {
    setPostingId(item.id);
    setPostErrors((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
    const result = await postTweet(item.editedText);
    setPostingId(null);
    if ("error" in result) {
      setPostErrors((prev) => ({ ...prev, [item.id]: result.error }));
    } else {
      updateHistoryItem(item.id, {
        status: "posted",
        tweetUrl: result.tweetUrl,
        postedAt: new Date().toISOString(),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id
            ? { ...i, status: "posted", tweetUrl: result.tweetUrl }
            : i
        )
      );
    }
  };

  const handleUseAgain = (item: HistoryItem) => {
    const params = new URLSearchParams({ prompt: item.prompt });
    if (item.editedText) params.set("text", item.editedText);
    if (item.imageUrl) params.set("imageUrl", item.imageUrl);
    if (item.imagePrompt) params.set("imagePrompt", item.imagePrompt);
    router.push(`/generate?${params.toString()}`);
  };

  const handleDelete = (id: string) => {
    deleteHistoryItem(id);
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (items.length === 0) {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-6 text-xl font-semibold text-slate-100">History</h1>
        <p className="text-sm text-slate-500">
          No items yet. Generate a post to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">History</h1>
      <ul className="space-y-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex gap-3 rounded-md border border-slate-800 bg-slate-900 p-4"
          >
            {/* Image thumbnail */}
            {item.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.imageUrl}
                alt=""
                className="h-16 w-16 shrink-0 rounded-md object-cover"
              />
            )}

            {/* Content */}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm text-slate-100">{item.editedText}</p>
              <p className="text-xs text-slate-500 truncate">
                Prompt: {item.prompt}
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                >
                  {item.status}
                </span>
                <span className="text-xs text-slate-500">
                  {formatDate(item.createdAt)}
                </span>
                {item.scheduledFor && item.status === "scheduled" && (
                  <span className="text-xs text-slate-500">
                    Scheduled: {formatDate(item.scheduledFor)}
                  </span>
                )}
                {item.tweetUrl && (
                  <a
                    href={item.tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-slate-400 underline hover:text-slate-200"
                  >
                    View on X <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {isOverdue(item) && (
                  <button
                    type="button"
                    onClick={() => handlePostNow(item)}
                    disabled={postingId === item.id}
                    className="flex items-center gap-1 rounded bg-amber-900/50 px-2 py-0.5 text-xs font-medium text-amber-400 hover:bg-amber-900/80 disabled:opacity-50"
                  >
                    {postingId === item.id && <Loader2 className="h-3 w-3 animate-spin" />}
                    {postingId === item.id ? "Posting…" : "Post now"}
                  </button>
                )}
                {postErrors[item.id] && (
                  <p className="w-full text-xs text-red-400">{postErrors[item.id]}</p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex shrink-0 flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => handleUseAgain(item)}
                className="text-slate-600 hover:text-slate-300 focus:outline-none"
                aria-label="Use prompt again"
                title="Use again"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                className="text-slate-600 hover:text-red-400 focus:outline-none"
                aria-label="Delete item"
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
