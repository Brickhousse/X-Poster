"use client";

import { createContext, useContext, useState, useRef, type ReactNode } from "react";
import { generateText } from "@/app/actions/generate-text";
import { generateImage } from "@/app/actions/generate-image";
import { postTweet } from "@/app/actions/post-tweet";
import { fetchLinkPreview } from "@/app/actions/fetch-link-preview";
import { addHistoryItem, updateHistoryItem } from "@/lib/history-storage";
import type { GenerateFormValues } from "@/lib/generation-schema";

interface GenerateState {
  generatedText: string | null;
  textError: string | null;
  generatedImageUrl: string | null;
  imageError: string | null;
  missingKey: boolean;
  isGenerating: boolean;
  isRegeneratingImage: boolean;
  whyItWorks: string;
  lastImagePrompt: string;
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
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [missingKey, setMissingKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [whyItWorks, setWhyItWorks] = useState("");
  const [lastImagePrompt, setLastImagePrompt] = useState("");
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
    if (imageUrl) setGeneratedImageUrl(imageUrl);
    if (imagePrompt) setLastImagePrompt(imagePrompt);
  };

  const onSubmit = async (values: GenerateFormValues) => {
    setGeneratedText(null);
    setTextError(null);
    setGeneratedImageUrl(null);
    setImageError(null);
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
      let imagePrompt = values.prompt;

      if ("error" in textResult) {
        setTextError(textResult.error);
        if (textResult.error.includes("API key not set")) setMissingKey(true);
      } else {
        resolvedText = textResult.text;
        imagePrompt = textResult.imagePrompt;
        setGeneratedText(textResult.text);
        setEditedText(textResult.text);
        setWhyItWorks(textResult.whyItWorks);
        setLastImagePrompt(textResult.imagePrompt);

        const urlMatch = textResult.text.match(/https?:\/\/[^\s\]()]+/);
        if (urlMatch) {
          setIsFetchingLinkPreview(true);
          fetchLinkPreview(urlMatch[0]).then((res) => {
            if ("imageUrl" in res) setLinkPreviewImageUrl(res.imageUrl);
            setIsFetchingLinkPreview(false);
          });
        }
      }

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
      const imageToPost =
        selectedImage === "generated" ? generatedImageUrl :
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
        imageUrl: generatedImageUrl,
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
    setGeneratedImageUrl(null);
    setImageError(null);
    setLastPrompt("");
    setLastImagePrompt("");
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

  return (
    <GenerateContext.Provider value={{
      generatedText, textError, generatedImageUrl, imageError, missingKey,
      isGenerating, isRegeneratingImage, whyItWorks, lastImagePrompt,
      isPosting, postSuccess, postError, scheduleSuccess,
      lastPrompt, editedText, charLimit,
      linkPreviewImageUrl, isFetchingLinkPreview, selectedImage,
      setEditedText, setCharLimit, setMissingKey, setSelectedImage,
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
