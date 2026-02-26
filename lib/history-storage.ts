import type { HistoryItem } from "./history-schema";

const STORAGE_KEY = "xposter_history";

export function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryItem[];
  } catch {
    return [];
  }
}

export function addHistoryItem(item: HistoryItem): void {
  if (typeof window === "undefined") return;
  const history = loadHistory();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([item, ...history]));
}

export function updateHistoryItem(
  id: string,
  patch: Partial<Omit<HistoryItem, "id">>
): void {
  if (typeof window === "undefined") return;
  const history = loadHistory().map((item) =>
    item.id === id ? { ...item, ...patch } : item
  );
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}

export function deleteHistoryItem(id: string): void {
  if (typeof window === "undefined") return;
  const history = loadHistory().filter((item) => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
}
