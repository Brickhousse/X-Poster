const STORAGE_KEY = "xposter_x_access_token";

export function loadXToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY);
}

export function saveXToken(accessToken: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, accessToken);
}

export function clearXToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
