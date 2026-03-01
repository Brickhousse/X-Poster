"use client";

import { createContext, useContext, useState, useRef, type ReactNode } from "react";
import { generateInstagramText } from "@/app/actions/generate-text";
import { generateImage } from "@/app/actions/generate-image";
import { postInstagram } from "@/app/actions/post-instagram";
import { addHistoryItem, updateHistoryItem } from "@/app/actions/history";
import { uploadCustomImage } from "@/app/actions/upload-custom-image";
import type { GenerateFormValues } from "@/lib/generation-schema";

export interface ImageEntry {
  id: number;
  url: string | null;
  error: string | null;
  style: 0 | 1 | 2;
  loading: boolean;
}

interface InstagramState {
  generatedCaption: string | null;
  captionError: string | null;
  imagePool: ImageEntry[];
  selectedPoolIndex: number | null;
  isRegeneratingStyle: [boolean, boolean, boolean];
  missingKey: boolean;
  isGenerating: boolean;
  isRegeneratingImage: boolean;
  whyItWorks: string;
  lastImagePrompts: [string, string, string] | null;
  isPosting: boolean;
  postSuccess: { postUrl: string } | null;
  postError: string | null;
  editedCaption: string;
  selectedImage: "generated" | "custom" | "none";
  customImageUrl: string | null;
  isUploadingCustomImage: boolean;
  customUploadError: string;
  isGeneratingImages: boolean;
  textFirstMode: boolean;
  setTextFirstMode: (v: boolean) => void;
  handleGenerateImages: () => Promise<void>;
  setEditedCaption: (v: string) => void;
  setMissingKey: (v: boolean) => void;
  setSelectedImage: (v: "generated" | "custom" | "none") => void;
  setCustomImageUrl: (v: string | null) => void;
  setSelectedPoolIndex: (v: number | null) => void;
  onSubmit: (values: GenerateFormValues, textFirst?: boolean) => Promise<void>;
  handleApproveAndPost: () => Promise<void>;
  handleDiscard: () => void;
  handleRegenerateImage: (overridePrompts?: [string, string, string]) => Promise<void>;
  handleRegenerateOneImage: (style: 0 | 1 | 2) => Promise<void>;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleCustomUrl: (url: string) => void;
}

const InstagramContext = createContext<InstagramState | null>(null);

export function InstagramProvider({ children }: { children: ReactNode }) {
  const [generatedCaption, setGeneratedCaption] = useState<string | null>(null);
  const [captionError, setCaptionError] = useState<string | null>(null);
  const [imagePool, setImagePool] = useState<ImageEntry[]>([]);
  const [selectedPoolIndex, setSelectedPoolIndex] = useState<number | null>(null);
  const [isRegeneratingStyle, setIsRegeneratingStyle] = useState<[boolean, boolean, boolean]>([false, false, false]);
  const poolEntryId = useRef(0);
  const [missingKey, setMissingKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [whyItWorks, setWhyItWorks] = useState("");
  const [lastImagePrompts, setLastImagePrompts] = useState<[string, string, string] | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState<{ postUrl: string } | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [editedCaption, setEditedCaption] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const [selectedImage, setSelectedImage] = useState<"generated" | "custom" | "none">("generated");
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [isUploadingCustomImage, setIsUploadingCustomImage] = useState(false);
  const [customUploadError, setCustomUploadError] = useState("");
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [textFirstMode, setTextFirstMode] = useState(false);
  const currentHistoryId = useRef<string | null>(null);
  const currentEntryPosted = useRef(false);

  const makeLoadingEntry = (style: 0 | 1 | 2): ImageEntry => ({
    id: poolEntryId.current++,
    url: null,
    error: null,
    style,
    loading: true,
  });

  const onSubmit = async (values: GenerateFormValues, textFirst?: boolean) => {
    const isTextFirst = textFirst !== undefined ? textFirst : textFirstMode;
    if (textFirst !== undefined) setTextFirstMode(textFirst);

    setGeneratedCaption(null);
    setCaptionError(null);
    setMissingKey(false);
    setCustomImageUrl(null);
    setSelectedImage("generated");
    setPostSuccess(null);
    setPostError(null);
    currentHistoryId.current = null;
    currentEntryPosted.current = false;
    setLastPrompt(values.prompt);

    if (!isTextFirst) {
      poolEntryId.current = 0;
      setImagePool([makeLoadingEntry(0), makeLoadingEntry(1), makeLoadingEntry(2)]);
      setSelectedPoolIndex(0);
    } else {
      poolEntryId.current = 0;
      setImagePool([]);
      setSelectedPoolIndex(null);
    }
    setIsRegeneratingStyle([false, false, false]);
    setIsGenerating(true);

    try {
      const textResult = await generateInstagramText(values.prompt);

      let resolvedCaption: string | null = null;
      let imagePrompts: [string, string, string] = [values.prompt, values.prompt, values.prompt];

      if ("error" in textResult) {
        setCaptionError(textResult.error);
        if (textResult.error.includes("API key not set")) setMissingKey(true);
      } else {
        resolvedCaption = textResult.text;
        imagePrompts = textResult.imagePrompts;
        setGeneratedCaption(textResult.text);
        setEditedCaption(textResult.text);
        setWhyItWorks(textResult.whyItWorks);
        setLastImagePrompts(textResult.imagePrompts);
      }

      if (isTextFirst) {
        if (resolvedCaption) {
          const result = await addHistoryItem({
            prompt: values.prompt,
            imagePrompt: imagePrompts[0],
            editedText: resolvedCaption,
            imageUrl: null,
            allImageUrls: [],
            status: "draft",
            createdAt: new Date().toISOString(),
            platform: "instagram",
          });
          if ("id" in result) currentHistoryId.current = result.id;
        }
        return;
      }

      type IR = { url: string } | { error: string };
      const fallback: IR = { error: "Image generation failed. Please try again." };
      let r1: IR = fallback, r2: IR = fallback, r3: IR = fallback;
      try {
        [r1, r2, r3] = await Promise.all([
          generateImage(imagePrompts[0]),
          generateImage(imagePrompts[1]),
          generateImage(imagePrompts[2]),
        ]);
      } catch {}

      const results = [r1, r2, r3];
      setImagePool((prev) =>
        prev.map((entry) => {
          if (entry.id > 2) return entry;
          const r = results[entry.id];
          return {
            ...entry,
            loading: false,
            url: "error" in r ? null : r.url,
            error: "error" in r ? r.error : null,
          };
        })
      );

      if (resolvedCaption) {
        const allImageUrls = results
          .map((r) => ("error" in r ? null : r.url))
          .filter((u): u is string => u !== null);

        const result = await addHistoryItem({
          prompt: values.prompt,
          imagePrompt: imagePrompts[0],
          editedText: resolvedCaption,
          imageUrl: allImageUrls[0] ?? null,
          allImageUrls,
          status: "draft",
          createdAt: new Date().toISOString(),
          platform: "instagram",
        });
        if ("id" in result) {
          currentHistoryId.current = result.id;
          if (result.storageUrls.length > 0) {
            setImagePool((prev) =>
              prev.map((entry) => {
                if (entry.id > 2) return entry;
                const storageUrl = result.storageUrls[entry.id] ?? null;
                return storageUrl ? { ...entry, url: storageUrl } : entry;
              })
            );
          }
        }
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApproveAndPost = async () => {
    setPostError(null);
    setPostSuccess(null);

    const imageToPost =
      selectedImage === "generated"
        ? (selectedPoolIndex !== null ? imagePool[selectedPoolIndex]?.url ?? null : null)
        : selectedImage === "custom"
        ? customImageUrl
        : null;

    if (!imageToPost) {
      setPostError("Please select an image before posting to Instagram.");
      return;
    }

    setIsPosting(true);
    try {
      const result = await postInstagram(editedCaption, imageToPost);
      if ("error" in result) {
        setPostError(result.error);
      } else {
        setPostSuccess({ postUrl: result.postUrl });
        currentEntryPosted.current = true;
        if (currentHistoryId.current) {
          await updateHistoryItem(currentHistoryId.current, {
            editedText: editedCaption,
            imageUrl: imageToPost,
            status: "posted",
            tweetUrl: result.postUrl,
            postedAt: new Date().toISOString(),
          });
        }
      }
    } finally {
      setIsPosting(false);
    }
  };

  const handleDiscard = () => {
    setGeneratedCaption(null);
    setEditedCaption("");
    setCaptionError(null);
    setImagePool([]);
    setSelectedPoolIndex(null);
    setIsRegeneratingStyle([false, false, false]);
    poolEntryId.current = 0;
    setLastPrompt("");
    setLastImagePrompts(null);
    setWhyItWorks("");
    setMissingKey(false);
    setPostSuccess(null);
    setPostError(null);
    setCustomImageUrl(null);
    setSelectedImage("generated");
    setCustomUploadError("");
    currentHistoryId.current = null;
    currentEntryPosted.current = false;
  };

  const handleRegenerateImage = async (overridePrompts?: [string, string, string]) => {
    setIsRegeneratingImage(true);
    const prompts: [string, string, string] =
      overridePrompts ?? lastImagePrompts ?? [editedCaption || lastPrompt, editedCaption || lastPrompt, editedCaption || lastPrompt];

    poolEntryId.current = 0;
    setImagePool([makeLoadingEntry(0), makeLoadingEntry(1), makeLoadingEntry(2)]);
    setSelectedPoolIndex(0);

    try {
      const [r1, r2, r3] = await Promise.all([
        generateImage(prompts[0]),
        generateImage(prompts[1]),
        generateImage(prompts[2]),
      ]);
      const results = [r1, r2, r3];
      setImagePool((prev) =>
        prev.map((entry) => {
          if (entry.id > 2) return entry;
          const r = results[entry.id];
          return {
            ...entry,
            loading: false,
            url: "error" in r ? null : r.url,
            error: "error" in r ? r.error : null,
          };
        })
      );
      if ("error" in r1 && r1.error.includes("API key not set")) setMissingKey(true);
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const handleGenerateImages = async () => {
    if (!lastImagePrompts) return;
    const prompts = lastImagePrompts;
    setIsGeneratingImages(true);
    poolEntryId.current = 0;
    setImagePool([makeLoadingEntry(0), makeLoadingEntry(1), makeLoadingEntry(2)]);
    setSelectedPoolIndex(0);

    try {
      const [r1, r2, r3] = await Promise.all([
        generateImage(prompts[0]),
        generateImage(prompts[1]),
        generateImage(prompts[2]),
      ]);
      const results = [r1, r2, r3];
      setImagePool((prev) =>
        prev.map((entry) => {
          if (entry.id > 2) return entry;
          const r = results[entry.id];
          return {
            ...entry,
            loading: false,
            url: "error" in r ? null : r.url,
            error: "error" in r ? r.error : null,
          };
        })
      );
      if ("error" in r1 && r1.error.includes("API key not set")) setMissingKey(true);
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const handleRegenerateOneImage = async (style: 0 | 1 | 2) => {
    setIsRegeneratingStyle((prev) => {
      const next = [...prev] as [boolean, boolean, boolean];
      next[style] = true;
      return next;
    });
    const newId = poolEntryId.current++;
    setImagePool((prev) => [...prev, { id: newId, url: null, error: null, style, loading: true }]);

    const prompt = lastImagePrompts?.[style] ?? editedCaption ?? lastPrompt;
    try {
      const result = await generateImage(prompt);
      setImagePool((prev) =>
        prev.map((entry) =>
          entry.id === newId
            ? {
                ...entry,
                loading: false,
                url: "error" in result ? null : result.url,
                error: "error" in result ? result.error : null,
              }
            : entry
        )
      );
      if ("error" in result && result.error.includes("API key not set")) setMissingKey(true);
    } finally {
      setIsRegeneratingStyle((prev) => {
        const next = [...prev] as [boolean, boolean, boolean];
        next[style] = false;
        return next;
      });
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setCustomUploadError("Image must be under 8 MB.");
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
      }
      setIsUploadingCustomImage(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCustomUrl = (url: string) => {
    try {
      new URL(url);
      setCustomUploadError("");
      setCustomImageUrl(url);
      setSelectedImage("custom");
    } catch {
      setCustomUploadError("Invalid URL.");
    }
  };

  return (
    <InstagramContext.Provider
      value={{
        generatedCaption, captionError, imagePool, selectedPoolIndex, isRegeneratingStyle,
        missingKey, isGenerating, isRegeneratingImage, whyItWorks, lastImagePrompts,
        isPosting, postSuccess, postError, editedCaption, selectedImage, customImageUrl,
        isUploadingCustomImage, customUploadError, isGeneratingImages,
        textFirstMode, setTextFirstMode, handleGenerateImages,
        setEditedCaption, setMissingKey, setSelectedImage, setCustomImageUrl, setSelectedPoolIndex,
        onSubmit, handleApproveAndPost, handleDiscard,
        handleRegenerateImage, handleRegenerateOneImage, handleFileUpload, handleCustomUrl,
      }}
    >
      {children}
    </InstagramContext.Provider>
  );
}

export function useInstagram() {
  const ctx = useContext(InstagramContext);
  if (!ctx) throw new Error("useInstagram must be used within InstagramProvider");
  return ctx;
}
