"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { settingsSchema, type SettingsFormValues } from "@/lib/settings-schema";
import { loadSettings, saveSettings, clearSettings } from "@/lib/settings-storage";
import { loadXToken, clearXToken } from "@/lib/x-token-storage";
import { generateXAuthUrl } from "@/app/actions/x-auth";

export default function SettingsPage() {
  const [showGrok, setShowGrok] = useState(false);
  const [showOpenAi, setShowOpenAi] = useState(false);
  const [showXSecret, setShowXSecret] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [xConnected, setXConnected] = useState(false);
  const [xConnecting, setXConnecting] = useState(false);
  const [xConnectError, setXConnectError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      grokApiKey: "",
      openaiApiKey: "",
      xClientId: "",
      xClientSecret: "",
    },
  });

  useEffect(() => {
    const saved = loadSettings();
    if (Object.keys(saved).length > 0) {
      reset({ grokApiKey: "", openaiApiKey: "", xClientId: "", xClientSecret: "", ...saved });
    }
    setXConnected(!!loadXToken());
  }, [reset]);

  const handleConnectX = async () => {
    setXConnectError(null);
    const { xClientId, xClientSecret } = loadSettings();
    if (!xClientId || !xClientSecret) {
      setXConnectError("Save your X Client ID and Client Secret above before connecting.");
      return;
    }
    setXConnecting(true);
    const callbackUrl = `${window.location.origin}/auth/callback`;
    const result = await generateXAuthUrl(xClientId, xClientSecret, callbackUrl);
    if ("error" in result) {
      setXConnectError(result.error);
      setXConnecting(false);
      return;
    }
    sessionStorage.setItem("x_code_verifier", result.codeVerifier);
    sessionStorage.setItem("x_oauth_state", result.state);
    window.location.href = result.url;
  };

  const handleDisconnectX = () => {
    clearXToken();
    setXConnected(false);
    setXConnectError(null);
  };

  const handleClear = () => {
    clearSettings();
    reset({ grokApiKey: "", openaiApiKey: "", xClientId: "", xClientSecret: "" });
    setSavedOk(false);
  };

  const onSubmit = (values: SettingsFormValues) => {
    saveSettings(values);
    setSavedOk(true);
    setTimeout(() => setSavedOk(false), 2000);
  };

  return (
    <div className="max-w-xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-100">Settings</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
        {/* Grok API */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-300">Grok API</h2>
          <div className="space-y-1">
            <label htmlFor="grokApiKey" className="block text-sm text-slate-400">
              API Key
            </label>
            <div className="relative">
              <input
                id="grokApiKey"
                type={showGrok ? "text" : "password"}
                {...register("grokApiKey")}
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
            {errors.grokApiKey && (
              <p className="text-xs text-red-400">{errors.grokApiKey.message}</p>
            )}
          </div>
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
                {...register("openaiApiKey")}
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
        </section>

        {/* X (Twitter) OAuth 2.0 */}
        <section className="space-y-3">
          <h2 className="text-sm font-medium text-slate-300">X (Twitter) OAuth 2.0</h2>

          {/* Client ID */}
          <div className="space-y-1">
            <label htmlFor="xClientId" className="block text-sm text-slate-400">
              Client ID
            </label>
            <input
              id="xClientId"
              type="text"
              {...register("xClientId")}
              placeholder="your-client-id"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
            />
            {errors.xClientId && (
              <p className="text-xs text-red-400">{errors.xClientId.message}</p>
            )}
          </div>

          {/* Client Secret */}
          <div className="space-y-1">
            <label htmlFor="xClientSecret" className="block text-sm text-slate-400">
              Client Secret
            </label>
            <div className="relative">
              <input
                id="xClientSecret"
                type={showXSecret ? "text" : "password"}
                {...register("xClientSecret")}
                placeholder="your-client-secret"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 pr-10 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-slate-500 focus:ring-1 focus:ring-slate-500"
              />
              <button
                type="button"
                onClick={() => setShowXSecret((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                aria-label={showXSecret ? "Hide Client Secret" : "Show Client Secret"}
              >
                {showXSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {errors.xClientSecret && (
              <p className="text-xs text-red-400">{errors.xClientSecret.message}</p>
            )}
          </div>

          {/* Setup note */}
          <p className="text-xs text-slate-500">
            Need help?{" "}
            <a
              href="https://developer.twitter.com/en/portal/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 underline hover:text-slate-200"
            >
              Set up your X Developer App (OAuth 2.0 with PKCE) →
            </a>
          </p>
        </section>
        {/* Actions */}
        <div className="flex items-center gap-4">
          <button
            type="submit"
            className="rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
          >
            Save settings
          </button>
          {savedOk && (
            <span className="text-sm text-green-400">Saved</span>
          )}
        </div>
        <div className="border-t border-slate-800 pt-6">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-red-400 hover:border-red-400/50 hover:text-red-300 focus:outline-none focus:ring-2 focus:ring-red-400/30"
          >
            Clear all credentials
          </button>
        </div>
      </form>

      {/* X Account connection */}
      <section className="mt-8 space-y-3 border-t border-slate-800 pt-8">
        <h2 className="text-sm font-medium text-slate-300">X Account</h2>
        {xConnected ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-green-400">Connected</span>
            <button
              type="button"
              onClick={handleDisconnectX}
              className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-600"
            >
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
  );
}
