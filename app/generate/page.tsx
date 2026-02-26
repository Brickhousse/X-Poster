"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { Loader2 } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateSchema, type GenerateFormValues } from "@/lib/generation-schema";
import { generateText } from "@/app/actions/generate-text";
import { generateImage } from "@/app/actions/generate-image";
import { postTweet } from "@/app/actions/post-tweet";
import { loadSettings } from "@/lib/settings-storage";
import { loadXToken } from "@/lib/x-token-storage";
import { addHistoryItem, updateHistoryItem } from "@/lib/history-storage";

export default function GeneratePage() {
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState<{ tweetUrl: string } | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const currentHistoryId = useRef<string | null>(null);
  const [lastPrompt, setLastPrompt] = useState<string>("");
  const [editedText, setEditedText] = useState<string>("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefilledPrompt = params.get("prompt");
    if (prefilledPrompt) setValue("prompt", prefilledPrompt);
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

    const { grokApiKey } = loadSettings();
    if (!grokApiKey) {
      setMissingKey(true);
      return;
    }

    setLastPrompt(values.prompt);
    setIsGenerating(true);
    try {
      const [textResult, imageResult] = await Promise.all([
        generateText(values.prompt, grokApiKey),
        generateImage(values.prompt, grokApiKey),
      ]);

      const resolvedText = "error" in textResult ? null : textResult.text;
      const resolvedImageUrl = "error" in imageResult ? null : imageResult.url;

      if ("error" in textResult) {
        setTextError(textResult.error);
      } else {
        setGeneratedText(textResult.text);
      }

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
    const accessToken = loadXToken();
    if (!accessToken) {
      setPostError("X account not connected. Go to Settings to connect.");
      return;
    }
    setIsPosting(true);
    try {
      const result = await postTweet(editedText, accessToken);
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
    setMissingKey(false);
    setPostSuccess(null);
    setPostError(null);
    setShowSchedule(false);
    setScheduledFor("");
    setScheduleSuccess(false);
    currentHistoryId.current = null;
  };

  const handleRegenerateImage = async () => {
    const { grokApiKey } = loadSettings();
    if (!grokApiKey) { setMissingKey(true); return; }

    setIsRegeneratingImage(true);
    setImageError(null);
    setGeneratedImageUrl(null);
    try {
      const result = await generateImage(lastPrompt, grokApiKey);
      if ("error" in result) {
        setImageError(result.error);
      } else {
        setGeneratedImageUrl(result.url);
      }
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  return (
    <div className="max-w-2xl">
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
                rows={4}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                className="w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
              <p className={`text-right text-xs ${editedText.length >= 280 ? "text-red-400" : "text-slate-500"}`}>
                {editedText.length}/280
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
              {postError.includes("connect") && (
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
            <div className="h-64 w-full max-w-sm animate-pulse rounded-md bg-slate-800" />
          ) : imageError ? (
            <p className="text-sm text-red-400">{imageError}</p>
          ) : (
            <img
              src={generatedImageUrl!}
              alt="Generated"
              className="rounded-md border border-slate-700 w-full max-w-sm object-cover"
            />
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
  );
}
