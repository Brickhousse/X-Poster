"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { saveGrokKey } from "@/app/actions/save-grok-key";
import { removeGrokKey } from "@/app/actions/remove-grok-key";
import { disconnectX } from "@/app/actions/disconnect-x";
import { getSessionStatus } from "@/app/actions/get-session-status";
import { generateXAuthUrl } from "@/app/actions/x-auth";
import { saveSettings } from "@/app/actions/save-settings";
import { getSettings } from "@/app/actions/get-settings";
import { useGenerate } from "@/lib/generate-context";
import {
  DEFAULT_IMAGE_DESCRIPTIONS,
  DEFAULT_IMAGE_STYLE_NAMES,
} from "@/lib/prompt-override-schema";
import type { PromptOverride } from "@/lib/prompt-override-schema";

type Tab = "general" | "prompt-override";

const EMOJI_OPTIONS = [
  { value: "sparingly", label: "Sparingly (1–3)" },
  { value: "none", label: "None" },
  { value: "moderate", label: "Moderate (3–5)" },
] as const;

export default function SettingsPage() {
  const { setPromptOverride } = useGenerate();
  const [activeTab, setActiveTab] = useState<Tab>("general");

  // ── General tab state ──────────────────────────────────────────────────
  const [showGrok, setShowGrok] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [grokKey, setGrokKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [hasGrokKey, setHasGrokKey] = useState(false);
  const [hasOpenaiKey, setHasOpenaiKey] = useState(false);
  const [grokSaved, setGrokSaved] = useState(false);
  const [grokError, setGrokError] = useState<string | null>(null);
  const [grokSaving, setGrokSaving] = useState(false);
  const [grokRemoving, setGrokRemoving] = useState(false);
  const [openaiSaved, setOpenaiSaved] = useState(false);
  const [openaiSaving, setOpenaiSaving] = useState(false);
  const [xConnected, setXConnected] = useState(false);
  const [xConnecting, setXConnecting] = useState(false);
  const [xConnectError, setXConnectError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [xTier, setXTier] = useState<"free" | "premium">("free");

  // ── Prompt Override tab state ──────────────────────────────────────────
  const [brandVoice, setBrandVoice] = useState("");
  const [tone, setTone] = useState("");
  const [emojiUsage, setEmojiUsage] = useState<"sparingly" | "none" | "moderate">("sparingly");
  const [audience, setAudience] = useState("");
  const [niche, setNiche] = useState("");
  const [avoid, setAvoid] = useState("");
  const [allowFaces, setAllowFaces] = useState(false);
  const [xVideoSearch, setXVideoSearch] = useState(false);
  const [imgNames, setImgNames] = useState<string[]>(["", "", ""]);
  const [imgDescs, setImgDescs] = useState<string[]>([
    DEFAULT_IMAGE_DESCRIPTIONS[0],
    DEFAULT_IMAGE_DESCRIPTIONS[1],
    DEFAULT_IMAGE_DESCRIPTIONS[2],
  ]);
  const [expandedImg, setExpandedImg] = useState<number | null>(null);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideSaved, setOverrideSaved] = useState(false);
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    // Open the correct tab if ?tab= param is present
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam === "prompt-override") setActiveTab("prompt-override");

    getSessionStatus().then((status) => {
      setHasGrokKey(status.hasGrokKey);
      setXConnected(status.hasXToken);
    });
    getSettings().then((s) => {
      setXTier(s.xTier);
      setHasOpenaiKey(s.hasOpenaiKey);
      // Populate prompt override form
      const po = s.promptOverride;
      if (po) {
        if (po.brandVoice) setBrandVoice(po.brandVoice);
        if (po.textStyle?.tone) setTone(po.textStyle.tone ?? "");
        if (po.textStyle?.emojiUsage) setEmojiUsage(po.textStyle.emojiUsage);
        if (po.textStyle?.audience) setAudience(po.textStyle.audience);
        if (po.textStyle?.niche) setNiche(po.textStyle.niche);
        if (po.textStyle?.avoid) setAvoid(po.textStyle.avoid);
        if (po.imageStyles?.allowFaces !== undefined) setAllowFaces(po.imageStyles.allowFaces);
        if (po.xVideoSearch === true) setXVideoSearch(true);
        setImgNames([
          po.imageStyles?.image1?.name ?? "",
          po.imageStyles?.image2?.name ?? "",
          po.imageStyles?.image3?.name ?? "",
        ]);
        setImgDescs([
          po.imageStyles?.image1?.description || DEFAULT_IMAGE_DESCRIPTIONS[0],
          po.imageStyles?.image2?.description || DEFAULT_IMAGE_DESCRIPTIONS[1],
          po.imageStyles?.image3?.description || DEFAULT_IMAGE_DESCRIPTIONS[2],
        ]);
      }
    });
  }, []);

  // ── General tab handlers ───────────────────────────────────────────────
  const handleTierChange = async (tier: "free" | "premium") => {
    setXTier(tier);
    await saveSettings({ xTier: tier });
  };

  const handleSaveGrok = async () => {
    setGrokError(null);
    setGrokSaving(true);
    const result = await saveGrokKey(grokKey);
    setGrokSaving(false);
    if ("error" in result) {
      setGrokError(result.error);
    } else {
      setHasGrokKey(true);
      setGrokKey("");
      setGrokSaved(true);
      setTimeout(() => setGrokSaved(false), 2000);
    }
  };

  const handleRemoveGrok = async () => {
    setGrokRemoving(true);
    await removeGrokKey();
    setHasGrokKey(false);
    setGrokKey("");
    setGrokRemoving(false);
  };

  const handleSaveOpenAi = async () => {
    setOpenaiSaving(true);
    await saveSettings({ openaiApiKey: openaiKey });
    setOpenaiSaving(false);
    setHasOpenaiKey(true);
    setOpenaiKey("");
    setOpenaiSaved(true);
    setTimeout(() => setOpenaiSaved(false), 2000);
  };

  const handleRemoveOpenAi = async () => {
    await saveSettings({ openaiApiKey: "" });
    setOpenaiKey("");
    setHasOpenaiKey(false);
  };

  const handleConnectX = async () => {
    setXConnectError(null);
    setXConnecting(true);
    const callbackUrl = `${window.location.origin}/auth/callback`;
    const result = await generateXAuthUrl(callbackUrl);
    if ("error" in result) {
      setXConnectError(result.error);
      setXConnecting(false);
      return;
    }
    sessionStorage.setItem("x_code_verifier", result.codeVerifier);
    sessionStorage.setItem("x_oauth_state", result.state);
    window.location.href = result.url;
  };

  const handleDisconnectX = async () => {
    setDisconnecting(true);
    await disconnectX();
    setXConnected(false);
    setDisconnecting(false);
    setXConnectError(null);
  };

  // ── Prompt Override handlers ───────────────────────────────────────────
  const buildOverridePayload = (): PromptOverride => ({
    brandVoice: brandVoice.trim() || undefined,
    textStyle: {
      tone: tone.trim() || undefined,
      emojiUsage: emojiUsage !== "sparingly" ? emojiUsage : undefined,
      audience: audience.trim() || undefined,
      niche: niche.trim() || undefined,
      avoid: avoid.trim() || undefined,
    },
    imageStyles: {
      allowFaces,
      image1: { name: imgNames[0].trim() || undefined, description: imgDescs[0].trim() || undefined },
      image2: { name: imgNames[1].trim() || undefined, description: imgDescs[1].trim() || undefined },
      image3: { name: imgNames[2].trim() || undefined, description: imgDescs[2].trim() || undefined },
    },
    xVideoSearch: xVideoSearch || undefined,
  });

  const handleSaveOverride = async () => {
    setOverrideError(null);
    setOverrideSaving(true);
    const payload = buildOverridePayload();
    const result = await saveSettings({ promptOverride: payload });
    setOverrideSaving(false);
    if ("error" in result) {
      setOverrideError(result.error);
    } else {
      setPromptOverride(payload);
      setOverrideSaved(true);
      setTimeout(() => setOverrideSaved(false), 2000);
    }
  };

  const handleClearOverride = async () => {
    if (!window.confirm("Clear all prompt overrides and revert to system defaults?")) return;
    setOverrideSaving(true);
    await saveSettings({ promptOverride: null });
    setOverrideSaving(false);
    // Reset form
    setBrandVoice("");
    setTone("");
    setEmojiUsage("sparingly");
    setAudience("");
    setNiche("");
    setAvoid("");
    setAllowFaces(false);
    setXVideoSearch(false);
    setImgNames(["", "", ""]);
    setImgDescs([
      DEFAULT_IMAGE_DESCRIPTIONS[0],
      DEFAULT_IMAGE_DESCRIPTIONS[1],
      DEFAULT_IMAGE_DESCRIPTIONS[2],
    ]);
    setExpandedImg(null);
    setPromptOverride(null);
  };

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Settings</h1>

      {/* Tab navigation */}
      <div className="mb-6 flex gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
        <button
          type="button"
          onClick={() => setActiveTab("general")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
            activeTab === "general"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          General
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("prompt-override")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none ${
            activeTab === "prompt-override"
              ? "bg-slate-800 text-white"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Prompt Override
        </button>
      </div>

      {/* ── GENERAL TAB ────────────────────────────────────────────────────── */}
      {activeTab === "general" && (
        <div className="space-y-8">
          {/* Grok API */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-slate-300">Grok API</h2>
              {hasGrokKey && (
                <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-400">
                  Key saved
                </span>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="grokApiKey" className="block text-sm text-slate-400">
                {hasGrokKey ? "Replace API Key" : "API Key"}
              </label>
              <div className="relative">
                <input
                  id="grokApiKey"
                  type={showGrok ? "text" : "password"}
                  value={grokKey}
                  onChange={(e) => setGrokKey(e.target.value)}
                  placeholder="xai-..."
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowGrok((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={showGrok ? "Hide Grok API key" : "Show Grok API key"}
                >
                  {showGrok ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {grokError && <p className="text-xs text-red-400">{grokError}</p>}
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveGrok}
                disabled={grokSaving || !grokKey}
                className="flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {grokSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save key
              </button>
              {hasGrokKey && (
                <button
                  type="button"
                  onClick={handleRemoveGrok}
                  disabled={grokRemoving}
                  className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-red-800 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {grokRemoving && <Loader2 className="h-3 w-3 animate-spin" />}
                  Remove key
                </button>
              )}
              {grokSaved && <span className="text-sm text-green-400">Saved</span>}
            </div>
            <p className="text-xs text-slate-500">
              Need help?{" "}
              <a
                href="https://console.x.ai/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 underline hover:text-slate-200"
              >
                Get your Grok API key at console.x.ai →
              </a>
            </p>
          </section>

          {/* OpenAI API */}
          <section className="space-y-3">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-slate-300">
                OpenAI API{" "}
                <span className="text-xs font-normal text-slate-500">(optional fallback)</span>
              </h2>
              {hasOpenaiKey && (
                <span className="rounded-full bg-green-900/40 px-2 py-0.5 text-xs font-medium text-green-400">
                  Key saved
                </span>
              )}
            </div>
            <div className="space-y-1">
              <label htmlFor="openaiApiKey" className="block text-sm text-slate-400">
                {hasOpenaiKey ? "Replace API Key" : "API Key"}
              </label>
              <div className="relative">
                <input
                  id="openaiApiKey"
                  type={showOpenAi ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                />
                <button
                  type="button"
                  onClick={() => setShowOpenAi((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={showOpenAi ? "Hide OpenAI API key" : "Show OpenAI API key"}
                >
                  {showOpenAi ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSaveOpenAi}
                disabled={!openaiKey || openaiSaving}
                className="flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {openaiSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save key
              </button>
              {hasOpenaiKey && (
                <button
                  type="button"
                  onClick={handleRemoveOpenAi}
                  className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-red-800 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-slate-600"
                >
                  Remove key
                </button>
              )}
              {openaiSaved && <span className="text-sm text-green-400">Saved</span>}
            </div>
            <p className="text-xs text-slate-500">
              Need help?{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-400 underline hover:text-slate-200"
              >
                Get your OpenAI API key at platform.openai.com →
              </a>
            </p>
          </section>

          {/* X Account */}
          <section className="space-y-3 border-t border-slate-800 pt-8">
            <h2 className="text-sm font-medium text-slate-300">X Account</h2>
            <p className="text-xs text-slate-500">
              This app uses a shared X Developer App — no credentials needed from you.
            </p>

            {/* X Tier toggle */}
            <div className="space-y-1">
              <p className="text-sm text-slate-400">X subscription tier</p>
              <div className="flex rounded-md border border-slate-700 p-0.5 w-fit">
                <button
                  type="button"
                  onClick={() => handleTierChange("free")}
                  className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
                    xTier === "free"
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Free
                </button>
                <button
                  type="button"
                  onClick={() => handleTierChange("premium")}
                  className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${
                    xTier === "premium"
                      ? "bg-slate-700 text-slate-100"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  Premium
                </button>
              </div>
              <p className="text-xs text-slate-500">
                {xTier === "premium" ? "25,000 character limit" : "280 character limit"}
              </p>
            </div>

            {xConnected ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-green-400">Connected</span>
                <button
                  type="button"
                  onClick={handleDisconnectX}
                  disabled={disconnecting}
                  className="flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {disconnecting && <Loader2 className="h-3 w-3 animate-spin" />}
                  Disconnect
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleConnectX}
                disabled={xConnecting}
                className="flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {xConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                {xConnecting ? "Redirecting…" : "Connect X account"}
              </button>
            )}
            {xConnectError && (
              <p className="text-xs text-red-400">{xConnectError}</p>
            )}
            {xConnected && (
              <p className="text-xs text-slate-500">
                Token includes <code className="text-slate-400">offline.access</code> — reconnect once to refresh scopes if posting fails.
              </p>
            )}
          </section>
        </div>
      )}

      {/* ── PROMPT OVERRIDE TAB ────────────────────────────────────────────── */}
      {activeTab === "prompt-override" && (
        <div className="space-y-8">
          <p className="text-xs text-slate-500 -mt-2">
            Customize the AI&apos;s voice and image style. Structural rules (output format, hashtag placement, X specs) always stay fixed.
          </p>

          {/* Section 1: Brand Voice */}
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-slate-300">Brand Voice</h2>
            <div className="space-y-1">
              <label htmlFor="brandVoice" className="block text-xs text-slate-400">
                Describe your context, audience, and writing preferences
              </label>
              <textarea
                id="brandVoice"
                rows={4}
                value={brandVoice}
                onChange={(e) => setBrandVoice(e.target.value)}
                placeholder="e.g. I'm a DeFi founder. Audience: crypto traders. Use precise financial language. Avoid hype words like 'revolutionary'."
                className="w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
            </div>
          </section>

          {/* Section 2: Text Style */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-slate-300">Text Style</h2>

            <div className="grid grid-cols-2 gap-4">
              {/* Tone */}
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Tone</label>
                <input
                  type="text"
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  placeholder="e.g. dry wit, contrarian, poetic"
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                />
              </div>

              {/* Emoji usage */}
              <div className="space-y-1">
                <label className="block text-xs text-slate-400">Emoji usage</label>
                <select
                  value={emojiUsage}
                  onChange={(e) => setEmojiUsage(e.target.value as typeof emojiUsage)}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                >
                  {EMOJI_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}{o.value === "sparingly" ? " (default)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Audience */}
            <div className="space-y-1">
              <label htmlFor="audience" className="block text-xs text-slate-400">
                Target audience <span className="text-slate-600">(optional)</span>
              </label>
              <input
                id="audience"
                type="text"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. startup founders"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
            </div>

            {/* Niche */}
            <div className="space-y-1">
              <label htmlFor="niche" className="block text-xs text-slate-400">
                Industry / niche <span className="text-slate-600">(optional)</span>
              </label>
              <input
                id="niche"
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="e.g. fintech"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
            </div>

            {/* Avoid */}
            <div className="space-y-1">
              <label htmlFor="avoid" className="block text-xs text-slate-400">
                Always avoid <span className="text-slate-600">(optional)</span>
              </label>
              <input
                id="avoid"
                type="text"
                value={avoid}
                onChange={(e) => setAvoid(e.target.value)}
                placeholder="e.g. exclamation marks, buzzwords"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
            </div>
          </section>

          {/* Section 3: Image Styles */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-slate-300">Image Styles</h2>

            {/* Allow faces toggle */}
            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={allowFaces}
                  onChange={(e) => setAllowFaces(e.target.checked)}
                />
                <div
                  className={`h-5 w-9 rounded-full transition-colors ${
                    allowFaces ? "bg-violet-600" : "bg-slate-700"
                  }`}
                />
                <div
                  className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                    allowFaces ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </div>
              <div>
                <span className="text-sm text-slate-300">Allow realistic faces / people in images</span>
                <p className="text-xs text-slate-500">
                  {allowFaces
                    ? "Faces and people are allowed in generated images."
                    : "Default: no realistic sharp-focus faces or people."}
                </p>
              </div>
            </label>

            {/* Per-image panels */}
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-md border border-slate-700 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedImg(expandedImg === i ? null : i)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-800/50 focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-300">
                      Image {i + 1}
                    </span>
                    <span className="text-xs text-slate-500">
                      {imgNames[i] ? `— ${imgNames[i]}` : `— ${DEFAULT_IMAGE_STYLE_NAMES[i]}`}
                    </span>
                  </div>
                  {expandedImg === i ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                {expandedImg === i && (
                  <div className="border-t border-slate-700 px-4 py-4 space-y-3 bg-slate-800/30">
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-400">
                        Style name <span className="text-slate-600">(label only)</span>
                      </label>
                      <input
                        type="text"
                        value={imgNames[i]}
                        onChange={(e) => {
                          const next = [...imgNames];
                          next[i] = e.target.value;
                          setImgNames(next);
                        }}
                        placeholder={`e.g. "${DEFAULT_IMAGE_STYLE_NAMES[i]}"`}
                        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs text-slate-400">Style description</label>
                      <textarea
                        rows={4}
                        value={imgDescs[i]}
                        onChange={(e) => {
                          const next = [...imgDescs];
                          next[i] = e.target.value;
                          setImgDescs(next);
                        }}
                        className="w-full resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
                      />
                      <p className="text-xs text-slate-600">
                        X format spec always appended:{" "}
                        {i === 0 ? "16:9" : "1:1 square"}, 8K.
                        {!allowFaces && " No faces."}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </section>

          {/* Section 4: X Features */}
          <section className="space-y-4">
            <h2 className="text-sm font-medium text-slate-300">X Features</h2>

            <label className="flex cursor-pointer items-center gap-3">
              <div className="relative flex-shrink-0">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={xVideoSearch}
                  onChange={(e) => setXVideoSearch(e.target.checked)}
                />
                <div className={`h-5 w-9 rounded-full transition-colors ${
                  xVideoSearch ? "bg-violet-600" : "bg-slate-700"
                }`} />
                <div className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  xVideoSearch ? "translate-x-4" : "translate-x-0"
                }`} />
              </div>
              <div>
                <span className="text-sm text-slate-300">X Video Search</span>
                <p className="text-xs text-slate-500">
                  {xVideoSearch
                    ? "Grok will search X for a relevant recent video post and embed its URL in the generated post."
                    : "When enabled, Grok searches X/Twitter for a relevant recent video post to include."}
                </p>
              </div>
            </label>
          </section>

          {/* Save / Clear */}
          <div className="flex items-center gap-3 border-t border-slate-800 pt-6">
            <button
              type="button"
              onClick={handleSaveOverride}
              disabled={overrideSaving}
              className="flex items-center gap-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {overrideSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
            <button
              type="button"
              onClick={handleClearOverride}
              disabled={overrideSaving}
              className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:border-red-800 hover:text-red-400 focus:outline-none focus:ring-2 focus:ring-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear All
            </button>
            {overrideSaved && <span className="text-sm text-green-400">Saved</span>}
            {overrideError && <span className="text-sm text-red-400">{overrideError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
