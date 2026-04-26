/**
 * Centralised user-configurable runtime settings stored in localStorage.
 * All keys are read with SSR-safe guards.
 */

export const SETTINGS_KEYS = {
  elevenKey: "elevenlabs_api_key",
  voiceId: "elevenlabs_voice_id",
  ollamaBase: "r2d2.ollamaBase",
  modelName: "r2d2.modelName",
  liteMode: "r2d2.liteMode",
  wakeWord: "r2d2.wakeWord",
} as const;

const safeGet = (k: string, fallback = ""): string => {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(k) ?? fallback;
};

const safeSet = (k: string, v: string) => {
  if (typeof window === "undefined") return;
  if (v) localStorage.setItem(k, v);
  else localStorage.removeItem(k);
};

export const getOllamaBase = () =>
  safeGet(SETTINGS_KEYS.ollamaBase, "http://127.0.0.1:11434");
export const setOllamaBase = (v: string) => safeSet(SETTINGS_KEYS.ollamaBase, v);

export const getLiteMode = (): boolean =>
  safeGet(SETTINGS_KEYS.liteMode, "0") === "1";
export const setLiteMode = (on: boolean) =>
  safeSet(SETTINGS_KEYS.liteMode, on ? "1" : "0");

export const getWakeWordEnabled = (): boolean =>
  safeGet(SETTINGS_KEYS.wakeWord, "0") === "1";
export const setWakeWordEnabled = (on: boolean) =>
  safeSet(SETTINGS_KEYS.wakeWord, on ? "1" : "0");

/** Mask a key as ••••••••••••abcd */
export function maskSecret(s: string, visible = 4): string {
  if (!s) return "";
  if (s.length <= visible) return "•".repeat(s.length);
  return "•".repeat(Math.min(12, s.length - visible)) + s.slice(-visible);
}

/** Fetch available models from a local Ollama daemon. Browser-side. */
export async function fetchOllamaModels(base = getOllamaBase()): Promise<string[]> {
  try {
    const r = await fetch(base.replace(/\/$/, "") + "/api/tags", {
      method: "GET",
    });
    if (!r.ok) return [];
    const j = (await r.json()) as { models?: { name: string }[] };
    return (j.models || []).map((m) => m.name);
  } catch {
    return [];
  }
}
