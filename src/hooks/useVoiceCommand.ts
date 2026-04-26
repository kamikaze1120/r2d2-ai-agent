/**
 * Continuous Web Speech API voice command listener with optional wake word.
 *
 * Detects a wake phrase ("Hey R2D2") and then captures the trailing command,
 * or runs in always-on mode where every utterance is treated as a command.
 *
 * Browser support: Chrome / Edge desktop. Falls back gracefully elsewhere.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: any) => void) | null;
  onerror: ((ev: any) => void) | null;
  onend: (() => void) | null;
};

type WindowWithSpeech = Window & {
  SpeechRecognition?: { new (): SpeechRecognitionLike };
  webkitSpeechRecognition?: { new (): SpeechRecognitionLike };
};

export type VoiceState = {
  supported: boolean;
  listening: boolean;
  transcript: string;
  partial: string;
  start: () => void;
  stop: () => void;
  toggle: () => void;
  error: string | null;
};

export type UseVoiceCommandOptions = {
  /** Lowercase wake phrase. If empty, every utterance fires as a command. */
  wakeWord?: string;
  /** Called with each finalised command (already trimmed). */
  onCommand?: (text: string) => void;
};

const isClient = typeof window !== "undefined";

export function useVoiceCommand(opts: UseVoiceCommandOptions = {}): VoiceState {
  const { wakeWord = "", onCommand } = opts;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [partial, setPartial] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const wantOnRef = useRef(false);
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    if (!isClient) return;
    const w = window as WindowWithSpeech;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    setSupported(!!Ctor);
  }, []);

  const handleFinalised = useCallback(
    (text: string) => {
      const cleaned = text.trim();
      if (!cleaned) return;
      setTranscript(cleaned);
      // Wake-word filter
      if (wakeWord) {
        const lower = cleaned.toLowerCase();
        const idx = lower.indexOf(wakeWord.toLowerCase());
        if (idx === -1) return;
        const command = cleaned.slice(idx + wakeWord.length).trim();
        if (command) onCommandRef.current?.(command);
      } else {
        onCommandRef.current?.(cleaned);
      }
    },
    [wakeWord],
  );

  const start = useCallback(() => {
    if (!isClient) return;
    const w = window as WindowWithSpeech;
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Speech recognition not supported in this browser.");
      return;
    }
    if (recRef.current) return;
    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (ev: any) => {
        let interim = "";
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i];
          const t = r[0]?.transcript || "";
          if (r.isFinal) handleFinalised(t);
          else interim += t;
        }
        setPartial(interim);
      };
      rec.onerror = (ev: any) => {
        setError(ev?.error || "Voice error");
      };
      rec.onend = () => {
        // Auto-restart while user wants it on
        if (wantOnRef.current) {
          try {
            rec.start();
          } catch {
            /* may throw if start() during stop */
          }
        } else {
          setListening(false);
          recRef.current = null;
        }
      };
      recRef.current = rec;
      wantOnRef.current = true;
      rec.start();
      setListening(true);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [handleFinalised]);

  const stop = useCallback(() => {
    wantOnRef.current = false;
    setListening(false);
    setPartial("");
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    recRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => () => stop(), [stop]);

  return { supported, listening, transcript, partial, start, stop, toggle, error };
}
