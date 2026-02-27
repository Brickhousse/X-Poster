"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2, ExternalLink, RefreshCw, Loader2, Star,
  MessageCircle, Repeat2, Heart, BarChart2,
} from "lucide-react";
import { getHistory, deleteHistoryItem, updateHistoryItem } from "@/app/actions/history";
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
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<"history" | "favorites">("history");
  const [togglingPin, setTogglingPin] = useState<string | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);
  const [postErrors, setPostErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    getHistory().then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const pinnedItems = items.filter((i) => i.pinned);
  const visibleItems = tab === "favorites" ? pinnedItems : items;
  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  // Clear selection when switching tabs if the selected item isn't in the new tab's list
  useEffect(() => {
    if (selectedId && !visibleItems.find((i) => i.id === selectedId)) {
      setSelectedId(null);
    }
  }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleTogglePin = async (item: HistoryItem) => {
    setTogglingPin(item.id);
    const newPinned = !item.pinned;
    await updateHistoryItem(item.id, { pinned: newPinned });
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, pinned: newPinned } : i)));
    setTogglingPin(null);
  };

  const handleDelete = async (id: string) => {
    await deleteHistoryItem(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleUseAgain = (item: HistoryItem) => {
    const params = new URLSearchParams({ prompt: item.prompt });
    if (item.editedText) params.set("text", item.editedText);
    if (item.imagePrompt) params.set("imagePrompt", item.imagePrompt);
    // Pass all stored image URLs; fall back to single imageUrl for legacy rows
    const urls = item.imageUrls ?? (item.imageUrl ? [item.imageUrl] : []);
    if (urls[0]) params.set("imageUrl1", urls[0]);
    if (urls[1]) params.set("imageUrl2", urls[1]);
    if (urls[2]) params.set("imageUrl3", urls[2]);
    router.push(`/generate?${params.toString()}`);
  };

  const handlePostNow = async (item: HistoryItem) => {
    setPostingId(item.id);
    setPostErrors((prev) => { const next = { ...prev }; delete next[item.id]; return next; });
    const result = await postTweet(item.editedText);
    setPostingId(null);
    if ("error" in result) {
      setPostErrors((prev) => ({ ...prev, [item.id]: result.error }));
    } else {
      await updateHistoryItem(item.id, {
        status: "posted",
        tweetUrl: result.tweetUrl,
        postedAt: new Date().toISOString(),
      });
      setItems((prev) =>
        prev.map((i) =>
          i.id === item.id ? { ...i, status: "posted", tweetUrl: result.tweetUrl } : i
        )
      );
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-6 text-xl font-semibold text-slate-100">History</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-md bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <h1 className="mb-4 text-xl font-semibold text-slate-100">History</h1>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* ── LEFT: list panel ── */}
        <div className="w-full min-w-0 lg:w-2/5">
          {/* Tabs */}
          <div className="mb-3 flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
            <button
              type="button"
              onClick={() => setTab("history")}
              className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
                tab === "history"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              History
            </button>
            <button
              type="button"
              onClick={() => setTab("favorites")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
                tab === "favorites"
                  ? "bg-slate-800 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Favorites
              {pinnedItems.length > 0 && (
                <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-xs font-medium leading-none text-amber-400">
                  {pinnedItems.length}
                </span>
              )}
            </button>
          </div>

          {/* List */}
          {visibleItems.length === 0 ? (
            <p className="py-4 text-sm text-slate-500">
              {tab === "favorites"
                ? "No favorites yet. Star an item to save it here."
                : "No items yet. Generate a post to see it here."}
            </p>
          ) : (
            <ul className="space-y-2">
              {visibleItems.map((item) => (
                <li
                  key={item.id}
                  onClick={() => setSelectedId(item.id)}
                  className={`flex cursor-pointer gap-3 rounded-md border p-3 transition-colors ${
                    selectedId === item.id
                      ? "border-slate-600 bg-slate-800 ring-1 ring-slate-600"
                      : "border-slate-800 bg-slate-900 hover:bg-slate-800/50"
                  }`}
                >
                  {/* Thumbnail */}
                  {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded object-cover"
                    />
                  )}

                  {/* Content */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-100">{item.editedText}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{item.prompt}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
                      >
                        {item.status}
                      </span>
                      <span className="text-xs text-slate-500">{formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Right icons — stop propagation so clicking icons doesn't select the row */}
                  <div
                    className="flex shrink-0 flex-col items-center gap-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => handleTogglePin(item)}
                      disabled={togglingPin === item.id}
                      className="focus:outline-none disabled:opacity-50"
                      aria-label={item.pinned ? "Unpin" : "Pin to favorites"}
                      title={item.pinned ? "Unpin" : "Pin to favorites"}
                    >
                      <Star
                        className={`h-4 w-4 transition-colors ${
                          item.pinned
                            ? "fill-amber-400 text-amber-400"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUseAgain(item)}
                      className="text-slate-500 hover:text-slate-300 focus:outline-none"
                      aria-label="Use again"
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
          )}
        </div>

        {/* ── RIGHT: preview panel ── */}
        <div className="hidden lg:block lg:flex-1 sticky top-6">
          {!selectedItem ? (
            <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900">
              <p className="text-sm text-slate-500">Select an item to preview</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-widest text-slate-500">Preview</p>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleUseAgain(selectedItem)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 focus:outline-none"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Use Again
                </button>

                {selectedItem.tweetUrl && (
                  <a
                    href={selectedItem.tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    View on X
                  </a>
                )}

                {isOverdue(selectedItem) && (
                  <button
                    type="button"
                    onClick={() => handlePostNow(selectedItem)}
                    disabled={postingId === selectedItem.id}
                    className="flex items-center gap-1.5 rounded-md bg-amber-900/50 px-3 py-1.5 text-sm font-medium text-amber-400 hover:bg-amber-900/80 focus:outline-none disabled:opacity-50"
                  >
                    {postingId === selectedItem.id && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    )}
                    {postingId === selectedItem.id ? "Posting…" : "Post now"}
                  </button>
                )}

                {postErrors[selectedItem.id] && (
                  <p className="w-full text-xs text-red-400">{postErrors[selectedItem.id]}</p>
                )}

                <button
                  type="button"
                  onClick={() => handleDelete(selectedItem.id)}
                  className="flex items-center gap-1.5 rounded-md border border-red-900/50 px-3 py-1.5 text-sm font-medium text-red-400 hover:border-red-800 hover:text-red-300 focus:outline-none"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>

              {/* X post card */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 flex-shrink-0 rounded-full bg-slate-700" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold leading-tight text-slate-100">Your Name</span>
                      <span className="text-sm leading-tight text-slate-500">@yourhandle</span>
                    </div>
                  </div>
                  <span className="select-none text-lg font-bold leading-none text-slate-400">𝕏</span>
                </div>

                {/* Body */}
                <div className="mt-3">
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">
                    {selectedItem.editedText}
                  </p>
                </div>

                {/* Image */}
                {selectedItem.imageUrl && (
                  <div className="mt-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedItem.imageUrl}
                      alt="Post image"
                      className="w-full rounded-xl object-cover"
                    />
                  </div>
                )}

                {/* Meta row */}
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span>{selectedItem.editedText.length} chars</span>
                  <span>•</span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[selectedItem.status]}`}
                  >
                    {selectedItem.status}
                  </span>
                  <span>•</span>
                  <span>{formatDate(selectedItem.createdAt)}</span>
                </div>

                {/* Engagement bar */}
                <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
                  {[
                    { Icon: MessageCircle, label: "Reply" },
                    { Icon: Repeat2, label: "Repost" },
                    { Icon: Heart, label: "Like" },
                    { Icon: BarChart2, label: "Views" },
                  ].map(({ Icon, label }) => (
                    <button
                      key={label}
                      type="button"
                      disabled
                      className="flex cursor-default items-center gap-1.5 text-slate-600"
                      aria-label={label}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-xs">—</span>
                    </button>
                  ))}
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
