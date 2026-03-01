"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { exchangeInstagramCode } from "@/app/actions/instagram-token";

function CallbackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "error">("processing");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const returnedState = searchParams.get("state");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError(`Instagram authorization denied: ${searchParams.get("error_description") ?? errorParam}`);
      setStatus("error");
      return;
    }

    if (!code) {
      setError("No authorization code received from Instagram.");
      setStatus("error");
      return;
    }

    const savedState = sessionStorage.getItem("ig_oauth_state");
    if (savedState && returnedState && savedState !== returnedState) {
      setError("OAuth state mismatch. Please try connecting again.");
      setStatus("error");
      return;
    }

    const callbackUrl = `${window.location.origin}/auth/instagram/callback`;

    exchangeInstagramCode(code, callbackUrl).then((result) => {
      if ("error" in result) {
        setError(result.error);
        setStatus("error");
        return;
      }
      sessionStorage.removeItem("ig_oauth_state");
      router.replace("/settings");
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status === "error") {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-slate-100">Instagram connection failed</h1>
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
      <h1 className="text-xl font-semibold text-slate-100">Connecting Instagram…</h1>
      <p className="text-sm text-slate-400">Please wait while we complete authentication.</p>
    </div>
  );
}

export default function InstagramCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md space-y-2">
          <h1 className="text-xl font-semibold text-slate-100">Connecting Instagram…</h1>
          <p className="text-sm text-slate-400">Please wait while we complete authentication.</p>
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
