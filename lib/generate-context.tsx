"use client";

import { createContext, useContext, useState, useRef, type ReactNode } from "react";
import { generateText } from "@/app/actions/generate-text";
import { generateImage } from "@/app/actions/generate-image";
import { postTweet } from "@/app/actions/post-tweet";
import { fetchLinkPreview } from "@/app/actions/fetch-link-preview";
import { addHistoryItem, updateHistoryItem } from "@/lib/history-storage";
import type { GenerateFormValues } from "@/lib/generation-schema";

const STYLE_LABELS = ["Cinematic / Symbolic", "Surreal / Abstract", "Bold Graphic / Typographic"] as const;

interface GenerateState {
  generatedText: string | null;
  textError: string | null;
  imageUrls: [string | null, string | null, string | null];
  imageErrors: [string | null, string | null, string | null];
  selectedImageIndex: 0 | 1 | 2;
  styleLabels: typeof STYLE_LABELS;
  missingKey: boolean;
  isGenerating: boolean;
  isRegeneratingImage: boolean;
  whyItWorks: string;
  lastImagePrompts: [string, string, string] | null;
  isPosting: boolean;
  postSuccess: { tweetUrl: string } | null;
  postError: string | null;
  scheduleSuccess: boolean;
  lastPrompt: string;
  editedText: string;
  charLimit: number;
  linkPreviewImageUrl: string | null;
  isFetchingLinkPreview: boolean;
  selectedImage: "generated" | "link" | "none";
  setEditedText: (v: string) => void;
  setCharLimit: (v: number) => void;
  setMissingKey: (v: boolean) => void;
  setSelectedImage: (v: "generated" | "link" | "none") => void;
  setSelectedImageIndex: (v: 0 | 1 | 2) => void;
  onSubmit: (values: GenerateFormValues) => Promise<void>;
  handleApproveAndPost: () => Promise<void>;
  handleSchedule: (scheduledFor: string) => void;
  handleDiscard: () => void;
  handleRegenerateImage: () => Promise<void>;
  // allow history page to prefill state
  prefill: (opts: { prompt?: string; text?: string; imageUrl?: string; imagePrompt?: string }) => void;
}

const GenerateContext = createContext<GenerateState | null>(null);

export function GenerateProvider({ children }: { children: ReactNode }) {
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<[string | null, string | null, string | null]>([null, null, null]);
  const [imageErrors, setImageErrors] = useState<[string | null, string | null, string | null]>([null, null, null]);
  const [selectedImageIndex, setSelectedImageIndex] = useState<0 | 1 | 2>(0);
  const [missingKey, setMissingKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [whyItWorks, setWhyItWorks] = useState("");
  const [lastImagePrompts, setLastImagePrompts] = useState<[string, string, string] | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const [postSuccess, setPostSuccess] = useState<{ tweetUrl: string } | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [editedText, setEditedText] = useState("");
  const [charLimit, setCharLimit] = useState(280);
  const [linkPreviewImageUrl, setLinkPreviewImageUrl] = useState<string | null>(null);
  const [isFetchingLinkPreview, setIsFetchingLinkPreview] = useState(false);
  const [selectedImage, setSelectedImage] = useState<"generated" | "link" | "none">("generated");
  const currentHistoryId = useRef<string | null>(null);

  const prefill = ({ prompt, text, imageUrl, imagePrompt }: { prompt?: string; text?: string; imageUrl?: string; imagePrompt?: string }) => {
    if (prompt) setLastPrompt(prompt);
    if (text) { setGeneratedText(text); setEditedText(text); }
    if (imageUrl) setImageUrls([imageUrl, null, null]);
    if (imagePrompt) setLastImagePrompts([imagePrompt, imagePrompt, imagePrompt]);
  };

  const onSubmit = async (values: GenerateFormValues) => {
    setGeneratedText(null);
    setTextError(null);
    setImageUrls([null, null, null]);
    setImageErrors([null, null, null]);
    setSelectedImageIndex(0);
    setMissingKey(false);
    setLinkPreviewImageUrl(null);
    setSelectedImage("generated");
    setPostSuccess(null);
    setPostError(null);
    setScheduleSuccess(false);

    setLastPrompt(values.prompt);
    setIsGenerating(true);
    try {
      const textResult = await generateText(values.prompt);

      let resolvedText: string | null = null;
      let imagePrompts: [string, string, string] = [values.prompt, values.prompt, values.prompt];

      if ("error" in textResult) {
        setTextError(textResult.error);
        if (textResult.error.includes("API key not set")) setMissingKey(true);
      } else {
        resolvedText = textResult.text;
        imagePrompts = textResult.imagePrompts;
        setGeneratedText(textResult.text);
        setEditedText(textResult.text);
        setWhyItWorks(textResult.whyItWorks);
        setLastImagePrompts(textResult.imagePrompts);

        const urlMatch = textResult.text.match(/https?:\/\/[^\s\]()]+/);
        if (urlMatch) {
          setIsFetchingLinkPreview(true);
          fetchLinkPreview(urlMatch[0]).then((res) => {
            if ("imageUrl" in res) setLinkPreviewImageUrl(res.imageUrl);
            setIsFetchingLinkPreview(false);
          });
        }
      }

      const [r1, r2, r3] = await Promise.all([
        generateImage(imagePrompts[0]),
        generateImage(imagePrompts[1]),
        generateImage(imagePrompts[2]),
      ]);

      setImageUrls([
        "error" in r1 ? null : r1.url,
        "error" in r2 ? null : r2.url,
        "error" in r3 ? null : r3.url,
      ]);
      setImageErrors([
        "error" in r1 ? r1.error : null,
        "error" in r2 ? r2.error : null,
        "error" in r3 ? r3.error : null,
      ]);

      if (resolvedText) {
        const id = crypto.randomUUID();
        currentHistoryId.current = id;
        const firstUrl = "error" in r1 ? null : r1.url;
        addHistoryItem({
          id,
          prompt: values.prompt,
          imagePrompt: imagePrompts[0],
          editedText: resolvedText,
          imageUrl: firstUrl,
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
      const imageToPost =
        selectedImage === "generated" ? imageUrls[selectedImageIndex] :
        selectedImage === "link" ? linkPreviewImageUrl :
        null;
      const result = await postTweet(editedText, imageToPost ?? undefined);
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

  const handleSchedule = (scheduledFor: string) => {
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
        imageUrl: imageUrls[selectedImageIndex],
        status: "scheduled",
        createdAt: new Date().toISOString(),
        scheduledFor: isoScheduled,
      });
      currentHistoryId.current = id;
    }
    setScheduleSuccess(true);
  };

  const handleDiscard = () => {
    setGeneratedText(null);
    setEditedText("");
    setTextError(null);
    setImageUrls([null, null, null]);
    setImageErrors([null, null, null]);
    setSelectedImageIndex(0);
    setLastPrompt("");
    setLastImagePrompts(null);
    setWhyItWorks("");
    setMissingKey(false);
    setPostSuccess(null);
    setPostError(null);
    setScheduleSuccess(false);
    setLinkPreviewImageUrl(null);
    setSelectedImage("generated");
    currentHistoryId.current = null;
  };

  const handleRegenerateImage = async () => {
    setIsRegeneratingImage(true);
    setImageErrors([null, null, null]);
    setImageUrls([null, null, null]);
    const prompts: [string, string, string] = lastImagePrompts ?? [editedText || lastPrompt, editedText || lastPrompt, editedText || lastPrompt];
    try {
      const [r1, r2, r3] = await Promise.all([
        generateImage(prompts[0]),
        generateImage(prompts[1]),
        generateImage(prompts[2]),
      ]);
      setImageUrls([
        "error" in r1 ? null : r1.url,
        "error" in r2 ? null : r2.url,
        "error" in r3 ? null : r3.url,
      ]);
      setImageErrors([
        "error" in r1 ? r1.error : null,
        "error" in r2 ? r2.error : null,
        "error" in r3 ? r3.error : null,
      ]);
      if ("error" in r1 && r1.error.includes("API key not set")) setMissingKey(true);
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  return (
    <GenerateContext.Provider value={{
      generatedText, textError, imageUrls, imageErrors, selectedImageIndex, styleLabels: STYLE_LABELS,
      missingKey, isGenerating, isRegeneratingImage, whyItWorks, lastImagePrompts,
      isPosting, postSuccess, postError, scheduleSuccess,
      lastPrompt, editedText, charLimit,
      linkPreviewImageUrl, isFetchingLinkPreview, selectedImage,
      setEditedText, setCharLimit, setMissingKey, setSelectedImage, setSelectedImageIndex,
      onSubmit, handleApproveAndPost, handleSchedule, handleDiscard, handleRegenerateImage,
      prefill,
    }}>
      {children}
    </GenerateContext.Provider>
  );
}

export function useGenerate() {
  const ctx = useContext(GenerateContext);
  if (!ctx) throw new Error("useGenerate must be used within GenerateProvider");
  return ctx;
}
