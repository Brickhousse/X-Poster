import type { SettingsFormValues } from "./settings-schema";

const STORAGE_KEY = "xposter_settings";

export function loadSettings(): Partial<SettingsFormValues> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<SettingsFormValues>;
  } catch {
    return {};
  }
}

export function saveSettings(values: SettingsFormValues): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
}

export function clearSettings(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}
