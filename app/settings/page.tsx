"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { saveGrokKey } from "@/app/actions/save-grok-key";
import { clearSession } from "@/app/actions/clear-session";
import { getSessionStatus } from "@/app/actions/get-session-status";
import { generateXAuthUrl } from "@/app/actions/x-auth";
import { loadSettings, saveSettings } from "@/lib/settings-storage";

export default function SettingsPage() {
  const [showGrok, setShowGrok] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [grokKey, setGrokKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [hasGrokKey, setHasGrokKey] = useState(false);
  const [grokSaved, setGrokSaved] = useState(false);
  const [grokError, setGrokError] = useState<string | null>(null);
  const [grokSaving, setGrokSaving] = useState(false);
  const [openaiSaved, setOpenaiSaved] = useState(false);
  const [xConnected, setXConnected] = useState(false);
  const [xConnecting, setXConnecting] = useState(false);
  const [xConnectError, setXConnectError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    getSessionStatus().then((status) => {
      setHasGrokKey(status.hasGrokKey);
      setXConnected(status.hasXToken);
    });
    // Load OpenAI key from localStorage (stays client-side for now)
    const saved = loadSettings();
    if (saved.openaiApiKey) setOpenaiKey(saved.openaiApiKey);
  }, []);

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

  const handleSaveOpenAi = () => {
    saveSettings({ openaiApiKey: openaiKey });
    setOpenaiSaved(true);
    setTimeout(() => setOpenaiSaved(false), 2000);
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
    await clearSession();
    setXConnected(false);
    setHasGrokKey(false);
    setDisconnecting(false);
    setXConnectError(null);
  };

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Settings</h1>

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
          <h2 className="text-sm font-medium text-slate-300">
            OpenAI API{" "}
            <span className="text-xs font-normal text-slate-500">(optional fallback)</span>
          </h2>
          <div className="space-y-1">
            <label htmlFor="openaiApiKey" className="block text-sm text-slate-400">
              API Key
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
              disabled={!openaiKey}
              className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save key
            </button>
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
        </section>
      </div>
    </div>
  );
}
