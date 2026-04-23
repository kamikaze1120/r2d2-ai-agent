import { useCallback, useEffect, useRef, useState } from "react";
import { synthesizeSpeech } from "@/server/tts";

const VOICE_KEY = "r2d2.voiceId";
const AUTO_KEY = "r2d2.autoSpeak";

const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // George — JARVIS-like

export const VOICE_OPTIONS: { id: string; label: string }[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", label: "George — refined British (recommended)" },
  { id: "nPczCjzI2devNBz1zQrb", label: "Brian — warm American baritone" },
  { id: "IKne3meq5aSn9XLyUdCD", label: "Charlie — crisp, polished" },
  { id: "onwK4e9ZLuTAKqWW03F9", label: "Daniel — authoritative British" },
];

export function getVoiceId(): string {
  if (typeof window === "undefined") return DEFAULT_VOICE;
  return localStorage.getItem(VOICE_KEY) || DEFAULT_VOICE;
}

export function setVoiceId(id: string) {
  localStorage.setItem(VOICE_KEY, id);
}

export function getAutoSpeak(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(AUTO_KEY);
  return v === null ? true : v === "1";
}

export function setAutoSpeak(on: boolean) {
  localStorage.setItem(AUTO_KEY, on ? "1" : "0");
}

/** Hook returning a speak() function and current playback state. */
export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, voiceId?: string) => {
      if (!text.trim()) return;
      setError(null);
      stop();
      try {
        setSpeaking(true);
        const res = await synthesizeSpeech({
          data: { text, voiceId: voiceId || getVoiceId() },
        });
        if (!res.audio) {
          setError(res.error || "No audio returned");
          setSpeaking(false);
          return;
        }
        const audio = new Audio(`data:audio/mpeg;base64,${res.audio}`);
        audioRef.current = audio;
        audio.onended = () => {
          setSpeaking(false);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setSpeaking(false);
          setError("Playback failed");
        };
        await audio.play();
      } catch (e) {
        setSpeaking(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [stop],
  );

  useEffect(() => () => stop(), [stop]);

  return { speak, stop, speaking, error };
}
