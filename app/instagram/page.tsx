"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Loader2, Heart, MessageCircle, Bookmark, Send, Upload, RotateCcw,
} from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { generateSchema, type GenerateFormValues } from "@/lib/generation-schema";
import { getSessionStatus } from "@/app/actions/get-session-status";
import { getInstagramStatus } from "@/app/actions/get-instagram-status";
import { useInstagram } from "@/lib/instagram-context";
import { Tooltip } from "@/components/tooltip";

const CAPTION_LIMIT = 2200;

const IMAGE_STYLE_LABELS = ["Lifestyle", "Flat Lay", "Bold Graphic"] as const;

export default function InstagramGeneratePage() {
  const {
    generatedCaption, captionError, imagePool, selectedPoolIndex, isRegeneratingStyle,
    missingKey, isGenerating, isRegeneratingImage, whyItWorks,
    isPosting, postSuccess, postError,
    editedCaption, selectedImage, customImageUrl,
    isUploadingCustomImage, customUploadError, isGeneratingImages,
    textFirstMode, setTextFirstMode, handleGenerateImages,
    setEditedCaption, setMissingKey, setSelectedImage, setSelectedPoolIndex, setCustomImageUrl,
    onSubmit, handleApproveAndPost, handleDiscard, handleRegenerateOneImage,
    handleFileUpload, handleCustomUrl,
  } = useInstagram();

  const [showImageModal, setShowImageModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [customUrlInput, setCustomUrlInput] = useState("");
  const [igConnected, setIgConnected] = useState<boolean | null>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<GenerateFormValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: { prompt: "" },
  });

  useEffect(() => {
    getSessionStatus().then((status) => {
      if (!status.hasGrokKey) setMissingKey(true);
    });
    getInstagramStatus().then((status) => {
      setIgConnected(status.connected);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const charCount = editedCaption.length;
  const charCountColor =
    charCount >= CAPTION_LIMIT ? "text-red-400" :
    charCount >= CAPTION_LIMIT * 0.9 ? "text-amber-400" :
    "text-slate-500";

  const activeImageUrl =
    selectedImage === "generated"
      ? (selectedPoolIndex !== null ? imagePool[selectedPoolIndex]?.url ?? null : null)
      : selectedImage === "custom"
      ? customImageUrl
      : null;

  const anyImageVisible =
    imagePool.length > 0 || isGenerating || isRegeneratingImage || isGeneratingImages;
  const showImageSection = anyImageVisible || (generatedCaption !== null && !isGenerating);
  const showActions = (generatedCaption !== null || captionError || imagePool.length > 0) && !isGenerating;

  const handleCustomUrlSubmit = () => {
    const url = customUrlInput.trim();
    if (!url) return;
    handleCustomUrl(url);
    setCustomUrlInput("");
  };

  return (
    <div className="grid grid-cols-1 gap-6 items-start max-w-5xl md:grid-cols-2 md:gap-8">
      {/* LEFT COLUMN */}
      <div className="min-w-0">
        <h1 className="mb-6 text-xl font-semibold text-slate-100">IG Generate</h1>

        {/* Instagram not connected notice */}
        {igConnected === false && (
          <div className="mb-4 rounded-md border border-amber-800/50 bg-amber-900/20 px-4 py-3 text-sm text-amber-400">
            Instagram not connected.{" "}
            <a href="/settings" className="underline hover:text-amber-200">
              Go to Settings →
            </a>{" "}
            to connect your account before posting.
          </div>
        )}

        <form onSubmit={handleSubmit((v) => onSubmit(v, false))} className="space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="ig-prompt" className="text-sm text-slate-400">
                What do you want to post about?
              </label>
              <span className="text-xs text-slate-600">Model: grok-4-1-fast-reasoning</span>
            </div>
            <textarea
              id="ig-prompt"
              rows={4}
              {...register("prompt")}
              placeholder="e.g. Morning cold plunge routine for high performers"
              className="w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
            {errors.prompt && (
              <p className="text-xs text-red-400">{errors.prompt.message}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Tooltip text="Generate your Instagram caption and 3 square images at once" align="start">
              <button
                type="submit"
                disabled={isGenerating}
                className="flex items-center gap-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 text-sm font-medium text-white hover:from-purple-500 hover:to-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating && !textFirstMode && <Loader2 className="h-4 w-4 animate-spin" />}
                {isGenerating && !textFirstMode ? "Generating…" : "Generate All"}
              </button>
            </Tooltip>
            <Tooltip text="Generate caption first, then add images once it looks good" align="start">
              <button
                type="button"
                onClick={handleSubmit((v) => onSubmit(v, true))}
                disabled={isGenerating}
                className="flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating && textFirstMode && <Loader2 className="h-4 w-4 animate-spin" />}
                {isGenerating && textFirstMode ? "Generating…" : "Generate Caption"}
              </button>
            </Tooltip>
            {(editedCaption || imagePool.length > 0 || captionError) && (
              <Tooltip text="Clear everything and start fresh" align="start">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={isGenerating || isPosting}
                  className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
              </Tooltip>
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

        {/* Caption result */}
        {(isGenerating || generatedCaption !== null || captionError) && (
          <div className="mt-6 space-y-2">
            <h2 className="text-sm font-medium text-slate-300">Generated caption</h2>
            {isGenerating && !generatedCaption && !captionError ? (
              <div className="h-20 animate-pulse rounded-md bg-slate-800" />
            ) : captionError ? (
              <p className="text-sm text-red-400">{captionError}</p>
            ) : (
              <div className="space-y-1">
                <textarea
                  rows={10}
                  value={editedCaption}
                  onChange={(e) => setEditedCaption(e.target.value)}
                  className="w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                />
                <p className={`text-right text-xs ${charCountColor}`}>
                  {charCount}/{CAPTION_LIMIT.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Generate images — Text-first mode */}
        {textFirstMode && generatedCaption !== null && imagePool.length === 0 && !isGenerating && (
          <div className="mt-4">
            <Tooltip text="Create 3 square image options for your post" align="start">
              <button
                type="button"
                onClick={handleGenerateImages}
                disabled={isGeneratingImages}
                className="flex items-center gap-2 rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:border-slate-500 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingImages && <Loader2 className="h-4 w-4 animate-spin" />}
                {isGeneratingImages ? "Generating images…" : "Generate images"}
              </button>
            </Tooltip>
          </div>
        )}

        {/* Image style selector */}
        {showImageSection && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium text-slate-300">Choose an image</h2>
                {anyImageVisible && (
                  <span className="text-xs text-slate-600">Model: grok-imagine-image</span>
                )}
              </div>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-500 hover:text-slate-300">
                <input
                  type="radio"
                  name="igImageChoice"
                  checked={selectedImage === "none"}
                  onChange={() => setSelectedImage("none")}
                  className="accent-slate-400"
                />
                No image
              </label>
            </div>

            {/* Image grid — square aspect ratio for IG */}
            {anyImageVisible && (
              <div className="grid grid-cols-3 gap-2">
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
                          ? "border-pink-500 ring-2 ring-pink-500"
                          : "border-slate-700 hover:border-slate-500"
                      } ${entry.error ? "opacity-50" : ""}`}
                    >
                      {entry.loading ? (
                        <div className="aspect-square w-full animate-pulse rounded bg-slate-800" />
                      ) : entry.error ? (
                        <div className="flex aspect-square w-full items-center justify-center rounded bg-slate-800">
                          <span className="text-xs text-red-400 text-center px-1">Failed</span>
                        </div>
                      ) : entry.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={entry.url}
                          alt={IMAGE_STYLE_LABELS[entry.style]}
                          className="aspect-square w-full rounded object-cover"
                        />
                      ) : (
                        <div className="aspect-square w-full rounded bg-slate-800" />
                      )}
                      <div className="mt-1 flex items-center justify-between px-0.5">
                        <p className="text-xs text-slate-400 leading-tight truncate">
                          {IMAGE_STYLE_LABELS[entry.style]}
                        </p>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerateOneImage(entry.style);
                          }}
                          disabled={
                            entry.loading || isGenerating || isRegeneratingImage || isRegeneratingStyle[entry.style]
                          }
                          className="text-slate-600 hover:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none"
                          title={`Regenerate ${IMAGE_STYLE_LABELS[entry.style]}`}
                        >
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom image upload */}
            {!isGenerating && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label
                    className={`flex flex-shrink-0 cursor-pointer items-center gap-1.5 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 ${
                      isUploadingCustomImage ? "pointer-events-none opacity-50" : ""
                    }`}
                  >
                    {isUploadingCustomImage ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="h-3 w-3" />
                    )}
                    {isUploadingCustomImage ? "Uploading…" : "Upload"}
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      className="hidden"
                      disabled={isUploadingCustomImage}
                      onChange={handleFileUpload}
                    />
                  </label>
                  <input
                    type="url"
                    value={customUrlInput}
                    onChange={(e) => setCustomUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCustomUrlSubmit();
                    }}
                    onBlur={handleCustomUrlSubmit}
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
                        ? "border-pink-500 ring-2 ring-pink-500"
                        : "border-slate-700 hover:border-slate-500"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={customImageUrl}
                      alt="Custom"
                      className="aspect-square w-full rounded object-cover"
                    />
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
                {customUploadError && (
                  <p className="text-xs text-red-400">{customUploadError}</p>
                )}
              </div>
            )}
            <p className="text-xs text-slate-600">
              Instagram requires JPEG/PNG images, max 8 MB, 1:1 square recommended.
            </p>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN — Preview */}
      <div className="sticky top-6">
        {/* Why it works */}
        {whyItWorks && !isGenerating && (
          <div className="mb-4 rounded-md border border-slate-700/50 bg-slate-800/50 px-4 py-3 space-y-1">
            <p className="text-sm font-medium text-slate-400">Why it works</p>
            <div className="text-sm text-slate-500 whitespace-pre-line">{whyItWorks}</div>
          </div>
        )}

        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-slate-500">
          Preview
        </p>

        {/* Instagram post mock */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
          {/* Post header */}
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-100 leading-tight">yourhandle</span>
            </div>
            <span className="ml-auto text-xs text-slate-500">•••</span>
          </div>

          {/* Square image area */}
          <div className="aspect-square w-full bg-slate-800">
            {(isGenerating || isRegeneratingImage || isGeneratingImages) && !activeImageUrl ? (
              <div className="h-full w-full animate-pulse bg-slate-800" />
            ) : activeImageUrl ? (
              <button
                type="button"
                onClick={() => {
                  setModalImageUrl(activeImageUrl);
                  setShowImageModal(true);
                }}
                className="block h-full w-full focus:outline-none"
                title="Click to expand"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeImageUrl}
                  alt="Post image"
                  className="h-full w-full object-cover"
                />
              </button>
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <p className="text-sm italic text-slate-600">Image will appear here…</p>
              </div>
            )}
          </div>

          {/* Engagement bar */}
          <div className="flex items-center gap-4 px-4 pt-3">
            <Heart className="h-6 w-6 text-slate-600" />
            <MessageCircle className="h-6 w-6 text-slate-600" />
            <Send className="h-6 w-6 text-slate-600" />
            <Bookmark className="ml-auto h-6 w-6 text-slate-600" />
          </div>

          {/* Likes */}
          <div className="px-4 pt-1">
            <span className="text-xs font-semibold text-slate-400">— likes</span>
          </div>

          {/* Caption preview */}
          <div className="px-4 pt-1 pb-4">
            {isGenerating && !generatedCaption ? (
              <div className="space-y-1.5">
                <div className="h-2.5 w-full animate-pulse rounded bg-slate-700" />
                <div className="h-2.5 w-4/5 animate-pulse rounded bg-slate-700" />
                <div className="h-2.5 w-3/5 animate-pulse rounded bg-slate-700" />
              </div>
            ) : editedCaption ? (
              <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100 line-clamp-6">
                <span className="font-semibold text-slate-100">yourhandle</span>{" "}
                {editedCaption}
              </p>
            ) : (
              <p className="text-xs italic text-slate-600">Your caption will appear here…</p>
            )}
            {editedCaption && (
              <p className={`mt-1 text-right text-xs ${charCountColor}`}>
                {charCount}/{CAPTION_LIMIT.toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        {showActions && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <Tooltip text="Post directly to your Instagram Business/Creator account" align="end">
                <button
                  type="button"
                  onClick={handleApproveAndPost}
                  disabled={isPosting}
                  className="flex items-center gap-2 rounded-md bg-gradient-to-r from-purple-600 to-pink-500 px-4 py-2 text-sm font-medium text-white hover:from-purple-500 hover:to-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPosting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isPosting ? "Posting…" : "Approve & Post"}
                </button>
              </Tooltip>
              <Tooltip text="Discard this post and start fresh" align="end">
                <button
                  type="button"
                  onClick={handleDiscard}
                  disabled={isPosting}
                  className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Discard
                </button>
              </Tooltip>
            </div>

            {postSuccess && (
              <p className="text-sm text-green-400">
                Posted to Instagram!{" "}
                <a
                  href={postSuccess.postUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-green-200"
                >
                  View profile →
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
      </div>

      {/* Full-size image modal */}
      {showImageModal && modalImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="relative max-h-full max-w-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowImageModal(false)}
              className="absolute -right-3 -top-3 flex h-7 w-7 items-center justify-center rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-white focus:outline-none"
              aria-label="Close preview"
            >
              ✕
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
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
