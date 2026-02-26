"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { exchangeXCode } from "@/app/actions/x-token";
import { saveXToken } from "@/lib/x-token-storage";
import { loadSettings } from "@/lib/settings-storage";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");

    if (!code) {
      setError("No authorization code received from X.");
      setStatus("error");
      return;
    }

    const codeVerifier = sessionStorage.getItem("x_code_verifier");
    const savedState = sessionStorage.getItem("x_oauth_state");

    if (!codeVerifier) {
      setError("Missing code verifier. Please try connecting again.");
      setStatus("error");
      return;
    }

    if (savedState && returnedState && savedState !== returnedState) {
      setError("OAuth state mismatch. Please try connecting again.");
      setStatus("error");
      return;
    }

    const { xClientId, xClientSecret } = loadSettings();
    if (!xClientId || !xClientSecret) {
      setError("X credentials not found. Please save them in Settings first.");
      setStatus("error");
      return;
    }

    const callbackUrl = `${window.location.origin}/auth/callback`;

    exchangeXCode(code, codeVerifier, xClientId, xClientSecret, callbackUrl).then(
      (result) => {
        if ("error" in result) {
          setError(result.error);
          setStatus("error");
          return;
        }
        saveXToken(result.accessToken);
        sessionStorage.removeItem("x_code_verifier");
        sessionStorage.removeItem("x_oauth_state");
        router.replace("/generate");
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-slate-100">Connection failed</h1>
        <p className="text-sm text-red-400">{error}</p>
        <a
          href="/settings"
          className="inline-block rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-400 hover:border-slate-500 hover:text-slate-200"
        >
          Back to Settings
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-2">
      <h1 className="text-xl font-semibold text-slate-100">Connecting X account…</h1>
      <p className="text-sm text-slate-400">Please wait while we complete authentication.</p>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold text-slate-100">Connecting X account…</h1>
          <p className="text-sm text-slate-400">Please wait while we complete authentication.</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
