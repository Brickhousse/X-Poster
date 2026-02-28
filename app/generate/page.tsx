"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Loader2, MessageCircle, Repeat2, Heart, BarChart2, Shuffle, Upload, RotateCcw } from "lucide-react";
import { uploadCustomImage } from "@/app/actions/upload-custom-image";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateSchema, type GenerateFormValues } from "@/lib/generation-schema";
import { getSessionStatus } from "@/app/actions/get-session-status";
import { getSettings } from "@/app/actions/get-settings";
import { useGenerate } from "@/lib/generate-context";

export default function GeneratePage() {
  const {
    generatedText, textError, imagePool, selectedPoolIndex, isRegeneratingStyle,
    missingKey, isGenerating, isRegeneratingImage, whyItWorks,
    isPosting, postSuccess, postError, scheduleSuccess,
    editedText, charLimit,
    linkPreviewImageUrl, isFetchingLinkPreview, selectedImage,
    noveltyMode, setNoveltyMode,
    setEditedText, setCharLimit, setMissingKey, setSelectedImage, setSelectedPoolIndex,
    customImageUrl, setCustomImageUrl,
    onSubmit, handleApproveAndPost, handleSchedule, handleDiscard, handleRegenerateImage, handleRegenerateOneImage,
    clearLinkPreview, prefill,
  } = useGenerate();

  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [isUploadingCustomImage, setIsUploadingCustomImage] = useState(false);
  const [customUploadError, setCustomUploadError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<GenerateFormValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: { prompt: "" },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prefilledPrompt = params.get("prompt");
    const prefilledText = params.get("text");
    const prefilledImagePrompt = params.get("imagePrompt");
    // Collect all imageUrl1, imageUrl2, ... imageUrlN params (also accept legacy imageUrl)
    const prefilledImageUrls: string[] = [];
    const legacyUrl = params.get("imageUrl");
    if (legacyUrl) prefilledImageUrls.push(legacyUrl);
    for (let i = 1; ; i++) {
      const u = params.get(`imageUrl${i}`);
      if (!u) break;
      if (!prefilledImageUrls.includes(u)) prefilledImageUrls.push(u);
    }
    const hasStoredImages = prefilledImageUrls.length > 0;
    if (prefilledPrompt) {
      setValue("prompt", prefilledPrompt);
    } else {
      // Restore prompt from sessionStorage (persists across tab switches)
      try {
        const raw = sessionStorage.getItem("xposter_generate_draft");
        if (raw) {
          const s = JSON.parse(raw) as { lastPrompt?: string };
          if (s.lastPrompt) setValue("prompt", s.lastPrompt);
        }
      } catch {}
    }
    if (prefilledPrompt || prefilledText || hasStoredImages || prefilledImagePrompt) {
      prefill({
        prompt: prefilledPrompt ?? undefined,
        text: prefilledText ?? undefined,
        imageUrls: prefilledImageUrls,
        imagePrompt: prefilledImagePrompt ?? undefined,
      });
      // Only regenerate if there are no stored images to show
      if (prefilledImagePrompt && !hasStoredImages) {
        const prompts: [string, string, string] = [prefilledImagePrompt, prefilledImagePrompt, prefilledImagePrompt];
        handleRegenerateImage(prompts);
      }
    }

    getSessionStatus().then((status) => {
      if (!status.hasGrokKey) setMissingKey(true);
    });
    getSettings().then(({ xTier }) => {
      setCharLimit(xTier === "premium" ? 25000 : 280);
    });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const charCountColor =
    editedText.length >= charLimit ? "text-red-400" :
    editedText.length >= charLimit * 0.9 ? "text-amber-400" :
    "text-slate-500";

  const SHORT_STYLE_LABELS: Record<0 | 1 | 2, string> = {
    0: "Cinematic", 1: "Surreal", 2: "Bold Graphic",
  };

  const anyImageUrl = imagePool.find((e) => e.url !== null)?.url ?? null;
  const anyImageVisible = imagePool.length > 0 || isGenerating || isRegeneratingImage;

  const activeImageUrl =
    selectedImage === "generated"
      ? (selectedPoolIndex !== null ? imagePool[selectedPoolIndex]?.url ?? null : null)
      : selectedImage === "link" ? linkPreviewImageUrl
      : selectedImage === "custom" ? customImageUrl
      : null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setCustomUploadError("Image must be under 5 MB.");
      e.target.value = "";
      return;
    }
    setIsUploadingCustomImage(true);
    setCustomUploadError("");
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      const result = await uploadCustomImage(dataUrl);
      if ("error" in result) {
        setCustomUploadError(result.error);
      } else {
        setCustomImageUrl(result.url);
        setSelectedImage("custom");
        setCustomUrlInput("");
      }
      setIsUploadingCustomImage(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCustomUrl = () => {
    const url = customUrlInput.trim();
    if (!url) return;
    try {
      new URL(url);
      setCustomImageUrl(url);
      setSelectedImage("custom");
      setCustomUploadError("");
    } catch {
      setCustomUploadError("Invalid image URL.");
    }
  };
  const showLinkCard = !isGenerating && !!linkPreviewImageUrl;

  return (
    <div className="grid grid-cols-1 gap-6 items-start max-w-5xl md:grid-cols-2 md:gap-8">
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

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating && <Loader2 className="h-4 w-4 animate-spin" />}
            {isGenerating ? "Generating…" : "Generate"}
          </button>
          <button
            type="button"
            onClick={() => setNoveltyMode(!noveltyMode)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              noveltyMode
                ? "border-violet-500 bg-violet-500/10 text-violet-400"
                : "border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200"
            }`}
          >
            <Shuffle className="h-3 w-3" />
            Fresh topics
          </button>
          {(editedText || anyImageUrl || textError || imagePool.some((e) => e.error !== null)) && (
            <button
              type="button"
              onClick={handleDiscard}
              disabled={isGenerating || isPosting}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          )}
        </div>
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
      {(generatedText !== null || textError || imagePool.length > 0) && !isGenerating && (
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
                    onClick={() => { handleSchedule(scheduledFor); setShowSchedule(false); setScheduledFor(""); }}
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

      {/* Image style selector — 3-card grid */}
      {anyImageVisible && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-300">Choose an image</h2>
            <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500 hover:text-slate-300">
              <input
                type="radio"
                name="imageChoice"
                checked={selectedImage === "none"}
                onChange={() => setSelectedImage("none")}
                className="accent-slate-400"
              />
              No image
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {imagePool.map((entry, idx) => {
              const isSelected = selectedImage === "generated" && selectedPoolIndex === idx;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => {
                    setSelectedPoolIndex(idx);
                    setSelectedImage("generated");
                  }}
                  disabled={entry.loading || !!entry.error}
                  className={`rounded-md border p-1.5 text-left transition-colors focus:outline-none disabled:cursor-default ${
                    isSelected
                      ? "border-slate-400 ring-2 ring-slate-400"
                      : "border-slate-700 hover:border-slate-500"
                  } ${entry.error ? "opacity-50" : ""}`}
                >
                  {entry.loading ? (
                    <div className="h-24 w-full animate-pulse rounded bg-slate-800" />
                  ) : entry.error ? (
                    <div className="flex h-24 w-full items-center justify-center rounded bg-slate-800">
                      <span className="text-xs text-red-400 text-center px-1">Failed</span>
                    </div>
                  ) : entry.url ? (
                    <img
                      src={entry.url}
                      alt={SHORT_STYLE_LABELS[entry.style]}
                      className="h-24 w-full rounded object-cover"
                    />
                  ) : (
                    <div className="h-24 w-full rounded bg-slate-800" />
                  )}
                  <div className="mt-1 flex items-center justify-between px-0.5">
                    <p className="text-xs text-slate-400 leading-tight">{SHORT_STYLE_LABELS[entry.style]}</p>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleRegenerateOneImage(entry.style); }}
                      disabled={entry.loading || isGenerating || isRegeneratingImage || isRegeneratingStyle[entry.style]}
                      className="text-slate-600 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                      title={`Regenerate ${SHORT_STYLE_LABELS[entry.style]}`}
                    >
                      <RotateCcw className="h-3 w-3" />
                    </button>
                  </div>
                </button>
              );
            })}
            {showLinkCard && (
              <button
                type="button"
                onClick={() => setSelectedImage("link")}
                className={`rounded-md border p-1.5 text-left transition-colors focus:outline-none ${
                  selectedImage === "link"
                    ? "border-slate-400 ring-2 ring-slate-400"
                    : "border-slate-700 hover:border-slate-500"
                }`}
              >
                {isFetchingLinkPreview && !linkPreviewImageUrl ? (
                  <div className="h-24 w-full animate-pulse rounded bg-slate-800" />
                ) : linkPreviewImageUrl ? (
                  <img src={linkPreviewImageUrl} alt="Link preview" className="h-24 w-full rounded object-cover" onError={clearLinkPreview} />
                ) : (
                  <div className="h-24 w-full rounded bg-slate-800" />
                )}
                <p className="mt-1 text-center text-xs text-slate-400 leading-tight">Link preview</p>
              </button>
            )}
          </div>

          {!isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <label className={`flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 ${isUploadingCustomImage ? "pointer-events-none opacity-50" : ""}`}>
                  {isUploadingCustomImage ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                  {isUploadingCustomImage ? "Uploading…" : "Upload"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={isUploadingCustomImage}
                    onChange={handleFileUpload}
                  />
                </label>
                <input
                  type="url"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCustomUrl(); }}
                  onBlur={handleCustomUrl}
                  placeholder="or paste image URL…"
                  className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-100 placeholder-slate-600 outline-none focus:border-slate-500"
                />
              </div>
              {customImageUrl && (
                <button
                  type="button"
                  onClick={() => setSelectedImage("custom")}
                  className={`relative w-full rounded-md border p-1.5 text-left transition-colors focus:outline-none ${
                    selectedImage === "custom"
                      ? "border-slate-400 ring-2 ring-slate-400"
                      : "border-slate-700 hover:border-slate-500"
                  }`}
                >
                  <img src={customImageUrl} alt="Custom" className="h-20 w-full rounded object-cover" />
                  <div className="mt-1 flex items-center justify-between px-0.5">
                    <p className="text-xs text-slate-400 leading-tight">Custom</p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomImageUrl(null);
                        if (selectedImage === "custom") setSelectedImage("generated");
                        setCustomUrlInput("");
                      }}
                      className="text-xs text-slate-600 hover:text-slate-300 focus:outline-none"
                    >
                      ✕ Remove
                    </button>
                  </div>
                </button>
              )}
              {customUploadError && <p className="text-xs text-red-400">{customUploadError}</p>}
            </div>
          )}

          {/* Expand selected image */}
          {(() => {
            const expandUrl =
              selectedImage === "generated"
                ? (selectedPoolIndex !== null ? imagePool[selectedPoolIndex]?.url ?? null : null)
                : selectedImage === "link" ? linkPreviewImageUrl
                : selectedImage === "custom" ? customImageUrl
                : null;
            return expandUrl ? (
              <button
                type="button"
                onClick={() => { setModalImageUrl(expandUrl); setShowImageModal(true); }}
                className="group relative block w-full overflow-hidden rounded-md border border-slate-700 focus:outline-none"
                title="Click to expand"
              >
                <img src={expandUrl} alt="Selected image" className="w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-xs font-medium text-white opacity-0 transition-all group-hover:bg-black/30 group-hover:opacity-100">
                  Click to expand
                </span>
              </button>
            ) : null;
          })()}

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
            {(isGenerating || isRegeneratingImage) && !activeImageUrl ? (
              <div className="h-48 w-full animate-pulse rounded-xl bg-slate-800" />
            ) : selectedImage === "none" ? null
            : selectedImage === "link" && linkPreviewImageUrl ? (
              <button
                type="button"
                onClick={() => { setModalImageUrl(linkPreviewImageUrl); setShowImageModal(true); }}
                className="block w-full overflow-hidden rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                title="Click to expand"
              >
                <img src={linkPreviewImageUrl} alt="Link preview image" className="w-full object-cover" />
              </button>
            ) : activeImageUrl ? (
              <button
                type="button"
                onClick={() => { setModalImageUrl(activeImageUrl); setShowImageModal(true); }}
                className="block w-full overflow-hidden rounded-xl border border-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
                title="Click to expand"
              >
                <img src={activeImageUrl} alt="Post image" className="w-full object-cover" />
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
      {showImageModal && modalImageUrl && (
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
              src={modalImageUrl}
              alt="Full size image"
              className="max-h-[90vh] w-auto rounded-md object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
