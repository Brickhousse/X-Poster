"use client";

import { createContext, useContext, useState, useRef, useEffect, type ReactNode } from "react";
import { generateText } from "@/app/actions/generate-text";
import { generateImage } from "@/app/actions/generate-image";
import { postTweet } from "@/app/actions/post-tweet";
import { fetchLinkPreview } from "@/app/actions/fetch-link-preview";
import { addHistoryItem, updateHistoryItem, appendHistoryImage, updateHistoryImages } from "@/app/actions/history";
import { getSettings } from "@/app/actions/get-settings";
import type { GenerateFormValues } from "@/lib/generation-schema";
import type { PromptOverride } from "@/lib/prompt-override-schema";
import { isNonDefaultOverride } from "@/lib/prompt-override-schema";

export interface ImageEntry {
  id: number;        // unique per session, from incrementing ref
  url: string | null;
  error: string | null;
  style: 0 | 1 | 2; // which style prompt generated this
  loading: boolean;
}

const STYLE_LABELS = ["Cinematic / Symbolic", "Surreal / Abstract", "Bold Graphic / Typographic"] as const;

interface GenerateState {
  generatedText: string | null;
  textError: string | null;
  imagePool: ImageEntry[];
  selectedPoolIndex: number | null;
  isRegeneratingStyle: [boolean, boolean, boolean];
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
  draftSaveStatus: "unsaved" | "saved" | null;
  lastPrompt: string;
  editedText: string;
  charLimit: number;
  linkPreviewImageUrl: string | null;
  linkPreviewVideoUrl: string | null;
  isFetchingLinkPreview: boolean;
  selectedImage: "generated" | "link" | "link-video" | "custom" | "none";
  customImageUrl: string | null;
  noveltyMode: boolean;
  setNoveltyMode: (v: boolean) => void;
  textFirstMode: boolean;
  setTextFirstMode: (v: boolean) => void;
  isGeneratingImages: boolean;
  handleGenerateImages: () => Promise<void>;
  setEditedText: (v: string) => void;
  setCharLimit: (v: number) => void;
  setMissingKey: (v: boolean) => void;
  setSelectedImage: (v: "generated" | "link" | "link-video" | "custom" | "none") => void;
  setCustomImageUrl: (v: string | null) => void;
  setSelectedPoolIndex: (v: number | null) => void;
  promptOverride: PromptOverride | null;
  hasPromptOverride: boolean;
  setPromptOverride: (v: PromptOverride | null) => void;
  onSubmit: (values: GenerateFormValues, textFirst?: boolean) => Promise<void>;
  handleApproveAndPost: () => Promise<void>;
  handleSchedule: (scheduledFor: string) => void;
  handleDiscard: () => void;
  handleRegenerateImage: (overridePrompts?: [string, string, string]) => Promise<void>;
  handleRegenerateOneImage: (style: 0 | 1 | 2) => Promise<void>;
  clearLinkPreview: () => void;
  triggerLinkPreview: (url: string) => Promise<void>;
  // allow history page to prefill state
  prefill: (opts: { prompt?: string; text?: string; imageUrls?: string[]; imagePrompt?: string }) => void;
}

const GenerateContext = createContext<GenerateState | null>(null);

export function GenerateProvider({ children }: { children: ReactNode }) {
  const [generatedText, setGeneratedText] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
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
  const [postSuccess, setPostSuccess] = useState<{ tweetUrl: string } | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [scheduleSuccess, setScheduleSuccess] = useState(false);
  const [lastPrompt, setLastPrompt] = useState("");
  const [editedText, setEditedText] = useState("");
  const [charLimit, setCharLimit] = useState(280);
  const [linkPreviewImageUrl, setLinkPreviewImageUrl] = useState<string | null>(null);
  const [linkPreviewVideoUrl, setLinkPreviewVideoUrl] = useState<string | null>(null);
  const [linkPreviewSourceUrl, setLinkPreviewSourceUrl] = useState<string | null>(null);
  const [isFetchingLinkPreview, setIsFetchingLinkPreview] = useState(false);
  const [selectedImage, setSelectedImage] = useState<"generated" | "link" | "link-video" | "custom" | "none">("generated");
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [noveltyMode, setNoveltyMode] = useState(false);
  const [textFirstMode, setTextFirstMode] = useState(false);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [promptOverride, setPromptOverride] = useState<PromptOverride | null>(null);
  const currentHistoryId = useRef<string | null>(null);
  const currentEntryPosted = useRef(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [draftSaveStatus, setDraftSaveStatus] = useState<"unsaved" | "saved" | null>(null);
  const lastPreviewedUrl = useRef<string | null>(null);
  const linkPreviewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load prompt override from settings on mount
  useEffect(() => {
    getSettings().then((s) => {
      if (s.promptOverride) setPromptOverride(s.promptOverride);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasPromptOverride = isNonDefaultOverride(promptOverride);

  const makeLoadingEntry = (style: 0 | 1 | 2): ImageEntry => ({
    id: poolEntryId.current++,
    url: null, error: null, style, loading: true,
  });

  // ── Session persistence ──────────────────────────────────────────────────
  const SESSION_KEY = "xposter_generate_draft";

  // Restore from sessionStorage on mount (survives tab switches / reload)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s.generatedText) { setGeneratedText(s.generatedText); setEditedText(s.editedText ?? s.generatedText); }
      if (Array.isArray(s.imagePool)) {
        const restored: ImageEntry[] = (s.imagePool as ImageEntry[])
          .filter((e) => e.url !== null || e.error !== null);
        setImagePool(restored);
        poolEntryId.current = restored.length > 0
          ? Math.max(...restored.map((e) => e.id)) + 1 : 0;
        const idx = typeof s.selectedPoolIndex === "number"
          && s.selectedPoolIndex >= 0 && s.selectedPoolIndex < restored.length
            ? s.selectedPoolIndex
            : restored.length > 0 ? 0 : null;
        setSelectedPoolIndex(idx);
      }
      if (s.lastPrompt) setLastPrompt(s.lastPrompt);
      if (s.lastImagePrompts) setLastImagePrompts(s.lastImagePrompts);
      if (s.whyItWorks) setWhyItWorks(s.whyItWorks);
      if (s.selectedImage) setSelectedImage(s.selectedImage);
      if (s.customImageUrl) setCustomImageUrl(s.customImageUrl);
      if (s.linkPreviewImageUrl) setLinkPreviewImageUrl(s.linkPreviewImageUrl);
      if (s.linkPreviewVideoUrl) setLinkPreviewVideoUrl(s.linkPreviewVideoUrl);
      if (typeof s.noveltyMode === "boolean") setNoveltyMode(s.noveltyMode);
      if (typeof s.textFirstMode === "boolean") setTextFirstMode(s.textFirstMode);
      if (s.postSuccess) setPostSuccess(s.postSuccess);
      if (s.scheduleSuccess) setScheduleSuccess(s.scheduleSuccess);
      if (s.historyId) currentHistoryId.current = s.historyId;
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save result state to sessionStorage whenever it changes
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        generatedText, editedText,
        imagePool: imagePool.map((e) => e.loading ? { ...e, loading: false } : e),
        selectedPoolIndex,
        lastPrompt, lastImagePrompts, whyItWorks,
        selectedImage, customImageUrl, linkPreviewImageUrl, linkPreviewVideoUrl, noveltyMode, textFirstMode,
        postSuccess, scheduleSuccess,
        historyId: currentHistoryId.current,
      }));
    } catch {}
  }, [generatedText, editedText, imagePool, selectedPoolIndex,
      lastPrompt, lastImagePrompts, whyItWorks, selectedImage, customImageUrl,
      linkPreviewImageUrl, linkPreviewVideoUrl, noveltyMode, textFirstMode, postSuccess, scheduleSuccess]);

  // Auto-save edits to DB; create a fresh draft entry after posting
  useEffect(() => {
    if (!editedText || !currentHistoryId.current) return;

    if (currentEntryPosted.current) {
      // User is editing after posting — lock the posted entry and start a new draft
      currentEntryPosted.current = false; // only fire once per posting
      addHistoryItem({
        prompt: lastPrompt,
        editedText,
        imageUrl: null,
        allImageUrls: [],
        status: "draft",
        createdAt: new Date().toISOString(),
      }).then((result) => {
        if ("id" in result) currentHistoryId.current = result.id;
      });
      return;
    }

    // Normal case: debounce-save the current edit to the existing draft entry
    setDraftSaveStatus("unsaved");
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      if (currentHistoryId.current) {
        updateHistoryItem(currentHistoryId.current, { editedText }).then(() => {
          setDraftSaveStatus("saved");
        });
      }
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [editedText]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch link preview when the URL in the edited text changes
  useEffect(() => {
    const urlMatch = editedText.match(/https?:\/\/[^\s\]()]+/);
    const url = urlMatch?.[0] ?? null;

    if (url === lastPreviewedUrl.current) return;

    if (linkPreviewTimer.current) clearTimeout(linkPreviewTimer.current);

    if (!url) {
      lastPreviewedUrl.current = null;
      setLinkPreviewImageUrl(null);
      setLinkPreviewVideoUrl(null);
      setSelectedImage((prev) =>
        prev === "link" || prev === "link-video" ? "generated" : prev
      );
      return;
    }

    linkPreviewTimer.current = setTimeout(async () => {
      lastPreviewedUrl.current = url;
      setLinkPreviewImageUrl(null);
      setLinkPreviewVideoUrl(null);
      setIsFetchingLinkPreview(true);
      const res = await fetchLinkPreview(url);
      if (!("error" in res)) {
        if (res.imageUrl) { setLinkPreviewImageUrl(res.imageUrl); setSelectedImage("link"); }
        if (res.videoUrl) { setLinkPreviewVideoUrl(res.videoUrl); setSelectedImage("link-video"); }
      }
      setIsFetchingLinkPreview(false);
    }, 900);

    return () => { if (linkPreviewTimer.current) clearTimeout(linkPreviewTimer.current); };
  }, [editedText]); // eslint-disable-line react-hooks/exhaustive-deps

  const prefill = ({ prompt, text, imageUrls: urls, imagePrompt }: { prompt?: string; text?: string; imageUrls?: string[]; imagePrompt?: string }) => {
    setPostSuccess(null);
    setPostError(null);
    setScheduleSuccess(false);
    if (prompt) setLastPrompt(prompt);
    if (text) {
      setGeneratedText(text);
      setEditedText(text);
      setLinkPreviewImageUrl(null);
      const urlMatch = text.match(/https?:\/\/[^\s\]()]+/);
      if (urlMatch) {
        lastPreviewedUrl.current = urlMatch[0];
        setIsFetchingLinkPreview(true);
        fetchLinkPreview(urlMatch[0]).then((res) => {
          if (!("error" in res)) {
            if (res.imageUrl) setLinkPreviewImageUrl(res.imageUrl);
            if (res.videoUrl) setLinkPreviewVideoUrl(res.videoUrl);
          }
          setIsFetchingLinkPreview(false);
        });
      }
    }
    if (urls && urls.length > 0) {
      poolEntryId.current = 0;
      const newPool: ImageEntry[] = urls
        .filter((u) => !!u)
        .map((u, i) => ({ id: poolEntryId.current++, url: u, error: null, style: (i % 3) as 0 | 1 | 2, loading: false }));
      setImagePool(newPool);
      setSelectedPoolIndex(newPool.length > 0 ? 0 : null);
    }
    if (imagePrompt) setLastImagePrompts([imagePrompt, imagePrompt, imagePrompt]);
  };

  const onSubmit = async (values: GenerateFormValues, textFirst?: boolean) => {
    const isTextFirst = textFirst !== undefined ? textFirst : textFirstMode;
    if (textFirst !== undefined) setTextFirstMode(textFirst);

    // Capture before any state resets so novelty directive can exclude current draft
    const inSessionDraft = noveltyMode && editedText
      ? { text: editedText, prompt: lastPrompt || values.prompt }
      : undefined;

    setGeneratedText(null);
    setTextError(null);
    setMissingKey(false);
    setLinkPreviewImageUrl(null);
    setLinkPreviewVideoUrl(null);
    setCustomImageUrl(null);
    setSelectedImage("generated");
    setPostSuccess(null);
    setPostError(null);
    setScheduleSuccess(false);
    currentHistoryId.current = null;
    currentEntryPosted.current = false;
    setDraftSaveStatus(null);

    setLastPrompt(values.prompt);

    // Reset pool
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
      const textResult = await generateText(values.prompt, noveltyMode, inSessionDraft);

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
          lastPreviewedUrl.current = urlMatch[0];
          setIsFetchingLinkPreview(true);
          fetchLinkPreview(urlMatch[0]).then((res) => {
            if (!("error" in res)) {
              if (res.imageUrl) setLinkPreviewImageUrl(res.imageUrl);
              if (res.videoUrl) setLinkPreviewVideoUrl(res.videoUrl);
            }
            setIsFetchingLinkPreview(false);
          });
        }
      }

      // ── Text-first: save draft with no images, then stop ──────────────
      if (isTextFirst) {
        if (resolvedText) {
          const result = await addHistoryItem({
            prompt: values.prompt,
            imagePrompt: imagePrompts[0],
            editedText: resolvedText,
            imageUrl: null,
            allImageUrls: [],
            status: "draft",
            createdAt: new Date().toISOString(),
          });
          if ("id" in result) currentHistoryId.current = result.id;
        }
        return; // finally still runs → setIsGenerating(false)
      }
      // ── All at once: existing image generation + history save block ────

      type IR = { url: string } | { error: string };
      const fallback: IR = { error: "Image generation failed. Please try again." };
      let r1: IR = fallback, r2: IR = fallback, r3: IR = fallback;
      try {
        [r1, r2, r3] = await Promise.all([
          generateImage(imagePrompts[0]),
          generateImage(imagePrompts[1]),
          generateImage(imagePrompts[2]),
        ]);
      } catch {
        // Server action threw — defaults already set to fallback errors
      }

      const results = [r1, r2, r3];
      setImagePool((prev) =>
        prev.map((entry) => {
          if (entry.id > 2) return entry; // guard: don't touch any regen entries
          const r = results[entry.id];
          return {
            ...entry, loading: false,
            url: "error" in r ? null : r.url,
            error: "error" in r ? r.error : null,
          };
        })
      );

      if (resolvedText) {
        const allImageUrls = results
          .map((r) => ("error" in r ? null : r.url))
          .filter((u): u is string => u !== null);

        const result = await addHistoryItem({
          prompt: values.prompt,
          imagePrompt: imagePrompts[0],
          editedText: resolvedText,
          imageUrl: allImageUrls[0] ?? null,
          allImageUrls,
          status: "draft",
          createdAt: new Date().toISOString(),
        });
        if ("id" in result) {
          currentHistoryId.current = result.id;
          // Update pool entries 0-2 to Storage URLs so post/schedule use persistent URLs
          if (result.storageUrls.length > 0) {
            setImagePool((prev) =>
              prev.map((entry) => {
                if (entry.id > 2) return entry; // only update initial 3
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
    setIsPosting(true);
    try {
      const imageToPost =
        selectedImage === "generated"
          ? (selectedPoolIndex !== null ? imagePool[selectedPoolIndex]?.url ?? null : null)
          : selectedImage === "link" ? linkPreviewImageUrl
          : selectedImage === "link-video" ? linkPreviewVideoUrl
          : selectedImage === "custom" ? customImageUrl
          : null;

      // For link preview cards (non-X-embed), X only shows a card when the source URL
      // is in the tweet body. Append it if the user didn't already include it.
      const isXEmbed = linkPreviewVideoUrl?.startsWith("https://platform.twitter.com/embed/");
      const needsUrlInBody =
        (selectedImage === "link" || selectedImage === "link-video") &&
        !isXEmbed &&
        linkPreviewSourceUrl &&
        !editedText.includes(linkPreviewSourceUrl);
      const tweetText = needsUrlInBody
        ? `${editedText}\n\n${linkPreviewSourceUrl}`
        : editedText;

      const result = await postTweet(tweetText, imageToPost ?? undefined);
      if ("error" in result) {
        setPostError(result.error);
      } else {
        setPostSuccess({ tweetUrl: result.tweetUrl });
        currentEntryPosted.current = true;
        if (currentHistoryId.current) {
          await updateHistoryItem(currentHistoryId.current, {
            editedText: tweetText,
            imageUrl: imageToPost ?? null,
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

  const handleSchedule = async (scheduledFor: string) => {
    if (!scheduledFor) return;
    const isoScheduled = new Date(scheduledFor).toISOString();
    const imageToSchedule =
      selectedImage === "generated"
        ? (selectedPoolIndex !== null ? imagePool[selectedPoolIndex]?.url ?? null : null)
        : selectedImage === "link" ? linkPreviewImageUrl
        : selectedImage === "link-video" ? linkPreviewVideoUrl
        : selectedImage === "custom" ? customImageUrl
        : null;
    if (currentHistoryId.current) {
      await updateHistoryItem(currentHistoryId.current, {
        editedText,
        imageUrl: imageToSchedule ?? null,
        status: "scheduled",
        scheduledFor: isoScheduled,
      });
    } else {
      const result = await addHistoryItem({
        prompt: lastPrompt,
        editedText,
        imageUrl: imageToSchedule ?? null,
        status: "scheduled",
        createdAt: new Date().toISOString(),
        scheduledFor: isoScheduled,
      });
      if ("id" in result) currentHistoryId.current = result.id;
    }
    setScheduleSuccess(true);
  };

  const handleDiscard = () => {
    setGeneratedText(null);
    setEditedText("");
    setTextError(null);
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
    setScheduleSuccess(false);
    setLinkPreviewImageUrl(null);
    setLinkPreviewVideoUrl(null);
    setLinkPreviewSourceUrl(null);
    setCustomImageUrl(null);
    setSelectedImage("generated");
    currentHistoryId.current = null;
    currentEntryPosted.current = false;
    lastPreviewedUrl.current = null;
    if (linkPreviewTimer.current) clearTimeout(linkPreviewTimer.current);
    setDraftSaveStatus(null);
    try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  };

  const clearLinkPreview = () => {
    lastPreviewedUrl.current = null;
    setLinkPreviewImageUrl(null);
    setLinkPreviewVideoUrl(null);
    setLinkPreviewSourceUrl(null);
    setSelectedImage((prev) =>
      prev === "link" || prev === "link-video" ? "generated" : prev as "generated" | "custom" | "none"
    );
  };

  const triggerLinkPreview = async (url: string) => {
    setLinkPreviewSourceUrl(url);
    setIsFetchingLinkPreview(true);
    const res = await fetchLinkPreview(url);
    if (!("error" in res)) {
      if (res.imageUrl) {
        setLinkPreviewImageUrl(res.imageUrl);
        setSelectedImage("link");
      }
      if (res.videoUrl) {
        setLinkPreviewVideoUrl(res.videoUrl);
        setSelectedImage("link-video");
      }
    }
    setIsFetchingLinkPreview(false);
  };

  const handleRegenerateImage = async (overridePrompts?: [string, string, string]) => {
    setIsRegeneratingImage(true);
    const hasEdits = !!(editedText && generatedText && editedText !== generatedText);
    const prompts: [string, string, string] = overridePrompts
      ?? (hasEdits ? [editedText, editedText, editedText] : lastImagePrompts)
      ?? [editedText || lastPrompt, editedText || lastPrompt, editedText || lastPrompt];

    // Reset pool to 3 fresh loading entries
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
            ...entry, loading: false,
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
            ...entry, loading: false,
            url: "error" in r ? null : r.url,
            error: "error" in r ? r.error : null,
          };
        })
      );

      if ("error" in r1 && r1.error.includes("API key not set")) setMissingKey(true);

      // Upload to Storage + update existing history record in background
      if (currentHistoryId.current) {
        const grokUrls = results
          .map((r) => ("error" in r ? null : r.url))
          .filter((u): u is string => u !== null);
        if (grokUrls.length > 0) {
          const histId = currentHistoryId.current;
          updateHistoryImages(histId, grokUrls).then((res) => {
            if ("storageUrls" in res && res.storageUrls.length > 0) {
              setImagePool((prev) =>
                prev.map((entry) => {
                  if (entry.id > 2) return entry;
                  const storageUrl = res.storageUrls[entry.id] ?? null;
                  return storageUrl ? { ...entry, url: storageUrl } : entry;
                })
              );
            }
          });
        }
      }
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

    const hasEdits = !!(editedText && generatedText && editedText !== generatedText);
    const prompt = (hasEdits ? editedText : lastImagePrompts?.[style]) ?? editedText ?? lastPrompt;
    try {
      const result = await generateImage(prompt);
      const grokUrl = "error" in result ? null : result.url;
      setImagePool((prev) =>
        prev.map((entry) =>
          entry.id === newId
            ? {
                ...entry, loading: false,
                url: grokUrl,
                error: "error" in result ? result.error : null,
              }
            : entry
        )
      );
      if ("error" in result && result.error.includes("API key not set")) setMissingKey(true);

      // Persist to history: upload to Storage and append to DB record in background
      if (grokUrl && currentHistoryId.current) {
        const histId = currentHistoryId.current;
        appendHistoryImage(histId, grokUrl).then((res) => {
          if ("storageUrl" in res) {
            // Swap ephemeral Grok URL → persistent Storage URL in pool
            setImagePool((prev) =>
              prev.map((e) => e.id === newId ? { ...e, url: res.storageUrl } : e)
            );
          }
        });
      }
    } finally {
      setIsRegeneratingStyle((prev) => {
        const next = [...prev] as [boolean, boolean, boolean];
        next[style] = false;
        return next;
      });
    }
  };

  return (
    <GenerateContext.Provider value={{
      generatedText, textError, imagePool, selectedPoolIndex, isRegeneratingStyle,
      styleLabels: STYLE_LABELS,
      missingKey, isGenerating, isRegeneratingImage, whyItWorks, lastImagePrompts,
      isPosting, postSuccess, postError, scheduleSuccess, draftSaveStatus,
      lastPrompt, editedText, charLimit,
      linkPreviewImageUrl, linkPreviewVideoUrl, isFetchingLinkPreview, selectedImage, customImageUrl,
      noveltyMode, setNoveltyMode,
      textFirstMode, setTextFirstMode, isGeneratingImages, handleGenerateImages,
      setEditedText, setCharLimit, setMissingKey, setSelectedImage, setSelectedPoolIndex, setCustomImageUrl,
      promptOverride, hasPromptOverride, setPromptOverride,
      onSubmit, handleApproveAndPost, handleSchedule, handleDiscard, handleRegenerateImage, handleRegenerateOneImage,
      clearLinkPreview, triggerLinkPreview, prefill,
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
