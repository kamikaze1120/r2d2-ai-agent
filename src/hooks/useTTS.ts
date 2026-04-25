import { useCallback, useEffect, useRef, useState } from "react";
import { synthesizeSpeech } from "@/server/tts";

const VOICE_KEY = "r2d2.voiceId";
const AUTO_KEY = "r2d2.autoSpeak";
const ELEVEN_KEY = "r2d2.elevenLabsKey";

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

export function getElevenKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ELEVEN_KEY) || "";
}
export function setElevenKey(k: string) {
  if (k) localStorage.setItem(ELEVEN_KEY, k.trim());
  else localStorage.removeItem(ELEVEN_KEY);
}

/**
 * --- Live amplitude pub/sub ---
 *
 * Single shared signal so the JARVIS globe (and any other visualizer) can
 * reflect whatever voice is playing right now, no matter which component
 * triggered the speech.
 */
type AmpListener = (amp: number) => void;
const _listeners = new Set<AmpListener>();
let _currentAmp = 0;

export function subscribeAmplitude(fn: AmpListener): () => void {
  _listeners.add(fn);
  fn(_currentAmp);
  return () => _listeners.delete(fn);
}
function _emitAmp(amp: number) {
  _currentAmp = amp;
  for (const l of _listeners) l(amp);
}

/** Hook returning a speak() function and current playback state. */
export function useTTS() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const _teardownAnalyser = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    _emitAmp(0);
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    _teardownAnalyser();
    setSpeaking(false);
  }, [_teardownAnalyser]);

  const _startAnalyser = useCallback((audio: HTMLAudioElement) => {
    try {
      if (!ctxRef.current) {
        const Ctx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        ctxRef.current = new Ctx();
      }
      const ctx = ctxRef.current;
      const src = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / data.length / 255; // 0..1
        _emitAmp(avg);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn("TTS analyser failed", e);
    }
  }, []);

  const speak = useCallback(
    async (text: string, voiceId?: string) => {
      if (!text.trim()) return;
      setError(null);
      stop();
      try {
        setSpeaking(true);
        const userKey = getElevenKey();
        const res = await synthesizeSpeech({
          data: {
            text,
            voiceId: voiceId || getVoiceId(),
            ...(userKey ? { userKey } : {}),
          },
        });
        if (!res.audio) {
          setError(res.error || "No audio returned");
          setSpeaking(false);
          return;
        }
        const audio = new Audio(`data:audio/mpeg;base64,${res.audio}`);
        audio.crossOrigin = "anonymous";
        audioRef.current = audio;
        audio.onended = () => {
          setSpeaking(false);
          audioRef.current = null;
          _teardownAnalyser();
        };
        audio.onerror = () => {
          setSpeaking(false);
          setError("Playback failed");
          _teardownAnalyser();
        };
        audio.onplay = () => _startAnalyser(audio);
        await audio.play();
      } catch (e) {
        setSpeaking(false);
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [stop, _startAnalyser, _teardownAnalyser],
  );

  useEffect(() => () => stop(), [stop]);

  return { speak, stop, speaking, error };
}
