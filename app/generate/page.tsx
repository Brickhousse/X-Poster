"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Loader2, MessageCircle, Repeat2, Heart, BarChart2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateSchema, type GenerateFormValues } from "@/lib/generation-schema";
import { generateText } from "@/app/actions/generate-text";
import { generateImage } from "@/app/actions/generate-image";
import { postTweet } from "@/app/actions/post-tweet";
import { getSessionStatus } from "@/app/actions/get-session-status";
import { loadSettings } from "@/lib/settings-storage";
import { addHistoryItem, updateHistoryItem } from "@/lib/history-storage";

export default function GeneratePage() {
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [whyItWorks, setWhyItWorks] = useState<string>("");
  const [lastImagePrompt, setLastImagePrompt] = useState<string>("");
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState<{ tweetUrl: string } | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const currentHistoryId = useRef<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>("");
  const [editedText, setEditedText] = useState<string>("");
  const [charLimit, setCharLimit] = useState(280);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefilledPrompt = params.get("prompt");
    const prefilledText = params.get("text");
    const prefilledImageUrl = params.get("imageUrl");
    const prefilledImagePrompt = params.get("imagePrompt");
    if (prefilledPrompt) { setValue("prompt", prefilledPrompt); setLastPrompt(prefilledPrompt); }
    if (prefilledText) setGeneratedText(prefilledText);
    if (prefilledImageUrl) setGeneratedImageUrl(prefilledImageUrl);
    if (prefilledImagePrompt) setLastImagePrompt(prefilledImagePrompt);

    // Check session status on mount for missing key notice
    getSessionStatus().then((status) => {
      if (!status.hasGrokKey) setMissingKey(true);
    });
    const { xTier } = loadSettings();
    setCharLimit(xTier === "premium" ? 25000 : 280);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (generatedText !== null) setEditedText(generatedText);
  }, [generatedText]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<GenerateFormValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: { prompt: "" },
  });

  const onSubmit = async (values: GenerateFormValues) => {
    setGeneratedText(null);
    setTextError(null);
    setGeneratedImageUrl(null);
    setImageError(null);
    setMissingKey(false);

    setLastPrompt(values.prompt);
    setIsGenerating(true);
    try {
      // Step 1: generate post text + crafted image prompt
      const textResult = await generateText(values.prompt);

      let resolvedText: string | null = null;
      let imagePrompt = values.prompt;

      if ("error" in textResult) {
        setTextError(textResult.error);
        if (textResult.error.includes("API key not set")) setMissingKey(true);
      } else {
        resolvedText = textResult.text;
        imagePrompt = textResult.imagePrompt;
        setGeneratedText(textResult.text);
        setWhyItWorks(textResult.whyItWorks);
        setLastImagePrompt(textResult.imagePrompt);
      }

      // Step 2: generate image using the crafted prompt
      const imageResult = await generateImage(imagePrompt);
      const resolvedImageUrl = "error" in imageResult ? null : imageResult.url;

      if ("error" in imageResult) {
        setImageError(imageResult.error);
      } else {
        setGeneratedImageUrl(imageResult.url);
      }

      if (resolvedText) {
        const id = crypto.randomUUID();
        currentHistoryId.current = id;
        addHistoryItem({
          id,
          prompt: values.prompt,
          imagePrompt,
          editedText: resolvedText,
          imageUrl: resolvedImageUrl,
          status: "draft",
          createdAt: new Date().toISOString(),
        });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveAndPost = async () => {
    setPostError(null);
    setPostSuccess(null);
    setIsPosting(true);
    try {
      const result = await postTweet(editedText);
      if ("error" in result) {
        setPostError(result.error);
      } else {
        setPostSuccess({ tweetUrl: result.tweetUrl });
        if (currentHistoryId.current) {
          updateHistoryItem(currentHistoryId.current, {
            editedText,
            status: "posted",
            tweetUrl: result.tweetUrl,
            postedAt: new Date().toISOString(),
          });
        }
      }
    } finally {
      setIsPosting(false);
    }
  };

  const handleSchedule = () => {
    if (!scheduledFor) return;
    const id = currentHistoryId.current ?? crypto.randomUUID();
    const isoScheduled = new Date(scheduledFor).toISOString();
    if (currentHistoryId.current) {
      updateHistoryItem(currentHistoryId.current, {
        editedText,
        status: "scheduled",
        scheduledFor: isoScheduled,
      });
    } else {
      addHistoryItem({
        id,
        prompt: lastPrompt,
        editedText,
        imageUrl: generatedImageUrl,
        status: "scheduled",
        createdAt: new Date().toISOString(),
        scheduledFor: isoScheduled,
      });
      currentHistoryId.current = id;
    }
    setScheduleSuccess(true);
    setShowSchedule(false);
  };

  const handleDiscard = () => {
    setGeneratedText(null);
    setEditedText("");
    setTextError(null);
    setGeneratedImageUrl(null);
    setImageError(null);
    setLastPrompt("");
    setLastImagePrompt("");
    setWhyItWorks("");
    setMissingKey(false);
    setPostSuccess(null);
    setPostError(null);
    setShowSchedule(false);
    setScheduledFor("");
    setScheduleSuccess(false);
    currentHistoryId.current = null;
  };

  const handleRegenerateImage = async () => {
    setIsRegeneratingImage(true);
    setImageError(null);
    setGeneratedImageUrl(null);
    try {
      const result = await generateImage(lastImagePrompt || editedText || lastPrompt);
      if ("error" in result) {
        setImageError(result.error);
        if (result.error.includes("API key not set")) setMissingKey(true);
      } else {
        setGeneratedImageUrl(result.url);
      }
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const charCountColor =
    editedText.length >= charLimit ? "text-red-400" :
    editedText.length >= charLimit * 0.9 ? "text-amber-400" :
    "text-slate-500";

  return (
    <div className="grid grid-cols-2 gap-8 items-start max-w-5xl">
      {/* LEFT COLUMN */}
      <div className="min-w-0">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Generate</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor="prompt" className="block text-sm text-slate-400">
            What do you want to post about?
          </label>
          <textarea
            id="prompt"
            rows={4}
            {...register("prompt")}
            placeholder="e.g. The impact of AI on software development in 2025"
            className="w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
          />
          {errors.prompt && (
            <p className="text-xs text-red-400">{errors.prompt.message}</p>
          )}
        </div>

        <button
          type="submit"
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
          {isGenerating ? "Generating…" : "Generate"}
        </button>
      </form>

      {/* Missing API key notice */}
      {missingKey && (
        <p className="mt-4 text-sm text-amber-400">
          Grok API key not set.{" "}
          <a href="/settings" className="underline hover:text-amber-200">
            Go to Settings →
          </a>
        </p>
      )}

      {/* Text result */}
      {(isGenerating || generatedText !== null || textError) && (
        <div className="mt-6 space-y-2">
          <h2 className="text-sm font-medium text-slate-300">Generated post</h2>
          {isGenerating && !generatedText && !textError ? (
            <div className="h-20 animate-pulse rounded-md bg-slate-800" />
          ) : textError ? (
            <p className="text-sm text-red-400">{textError}</p>
          ) : (
            <div className="space-y-1">
              <textarea
                rows={8}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
              <p className={`text-right text-xs ${charCountColor}`}>
                {editedText.length}/{charLimit.toLocaleString()}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions row — shown once generation completes */}
      {(generatedText !== null || textError || generatedImageUrl !== null || imageError) && !isGenerating && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleApproveAndPost}
              disabled={isPosting || !!postSuccess}
              className="flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPosting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isPosting ? "Posting…" : "Approve & Post"}
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isPosting}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Discard
            </button>
          </div>

          {/* Schedule toggle */}
          {!postSuccess && !scheduleSuccess && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowSchedule((v) => !v)}
                className="text-xs text-slate-500 underline hover:text-slate-300"
              >
                {showSchedule ? "Cancel scheduling" : "Schedule for later"}
              </button>
              {showSchedule && (
                <div className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={(e) => setScheduledFor(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                    className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                  />
                  <button
                    type="button"
                    onClick={handleSchedule}
                    disabled={!scheduledFor}
                    className="rounded-md border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Save schedule
                  </button>
                </div>
              )}
            </div>
          )}

          {scheduleSuccess && (
            <p className="text-sm text-amber-400">
              Scheduled. View in{" "}
              <a href="/history" className="underline hover:text-amber-200">
                History →
              </a>
            </p>
          )}

          {postSuccess && (
            <p className="text-sm text-green-400">
              Posted!{" "}
              <a
                href={postSuccess.tweetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-green-200"
              >
                View on X →
              </a>
            </p>
          )}
          {postError && (
            <p className="text-sm text-red-400">
              {postError}{" "}
              {(postError.includes("connect") || postError.includes("Settings")) && (
                <a href="/settings" className="underline hover:text-red-200">
                  Go to Settings →
                </a>
              )}
            </p>
          )}
        </div>
      )}

      {/* Image result */}
      {(isGenerating || isRegeneratingImage || generatedImageUrl !== null || imageError) && (
        <div className="mt-4 space-y-2">
          <h2 className="text-sm font-medium text-slate-300">Generated image</h2>
          {(isGenerating || isRegeneratingImage) && !generatedImageUrl && !imageError ? (
            <div className="h-64 w-full animate-pulse rounded-md bg-slate-800" />
          ) : imageError ? (
            <p className="text-sm text-red-400">{imageError}</p>
          ) : (
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="group relative block w-full overflow-hidden rounded-md border border-slate-700 focus:outline-none"
              title="Click to expand"
            >
              <img
                src={generatedImageUrl!}
                alt="Generated"
                className="w-full object-cover"
              />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-medium text-white opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                Click to expand
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={handleRegenerateImage}
            disabled={isGenerating || isRegeneratingImage}
            className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRegeneratingImage && <Loader2 className="h-3 w-3 animate-spin" />}
            {isRegeneratingImage ? "Regenerating…" : "Regenerate image"}
          </button>
        </div>
      )}
      </div>
      {/* RIGHT COLUMN */}
      <div className="sticky top-6">
        {/* Why it works */}
        {whyItWorks && !isGenerating && (
          <div className="mb-4 rounded-md border border-slate-700/50 bg-slate-800/50 px-4 py-3 space-y-1">
            <p className="text-sm font-medium text-slate-400">Why it works</p>
            <div className="text-sm text-slate-500 whitespace-pre-line">{whyItWorks}</div>
          </div>
        )}

        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500">Preview</p>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 flex-shrink-0 rounded-full bg-slate-700" />
              <div className="flex flex-col">
                <span className="text-sm font-bold text-slate-100 leading-tight">Your Name</span>
                <span className="text-sm text-slate-500 leading-tight">@yourhandle</span>
              </div>
            </div>
            <span className="text-slate-400 text-lg font-bold leading-none select-none">𝕏</span>
          </div>

          {/* Body text — 3 states */}
          <div className="mt-3">
            {isGenerating && !generatedText ? (
              <div className="space-y-2">
                <div className="h-3.5 w-full animate-pulse rounded bg-slate-700" />
                <div className="h-3.5 w-5/6 animate-pulse rounded bg-slate-700" />
                <div className="h-3.5 w-4/6 animate-pulse rounded bg-slate-700" />
              </div>
            ) : editedText ? (
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-100">{editedText}</p>
            ) : (
              <p className="text-sm italic text-slate-600">Your post will appear here…</p>
            )}
          </div>

          {/* Image — 3 states */}
          <div className="mt-3">
            {(isGenerating || isRegeneratingImage) && !generatedImageUrl ? (
              <div className="h-48 w-full animate-pulse rounded-xl bg-slate-800" />
            ) : generatedImageUrl ? (
              <button
                type="button"
                onClick={() => setShowImageModal(true)}
                className="block w-full overflow-hidden rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                title="Click to expand"
              >
                <img src={generatedImageUrl} alt="Post image" className="w-full object-cover" />
              </button>
            ) : null}
          </div>

          {/* Char count */}
          {(editedText || isGenerating) && (
            <div className="mt-2 text-right">
              <span className={`text-xs ${charCountColor}`}>{editedText.length}/{charLimit.toLocaleString()}</span>
            </div>
          )}

          {/* Engagement bar */}
          <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
            {[
              { Icon: MessageCircle, label: "Reply" },
              { Icon: Repeat2, label: "Repost" },
              { Icon: Heart, label: "Like" },
              { Icon: BarChart2, label: "Views" },
            ].map(({ Icon, label }) => (
              <button key={label} type="button" disabled
                className="flex items-center gap-1.5 text-slate-600 cursor-default" aria-label={label}>
                <Icon className="h-4 w-4" />
                <span className="text-xs">—</span>
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Full-size image modal */}
      {showImageModal && generatedImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setShowImageModal(false)}
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white focus:outline-none"
              aria-label="Close preview"
            >
              ✕
            </button>
            <img
              src={generatedImageUrl}
              alt="Generated full size"
              className="max-h-[90vh] w-auto rounded-md object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
