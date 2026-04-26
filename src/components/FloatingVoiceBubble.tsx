/**
 * Floating microphone & voice command bubble.
 *
 * Sits in the bottom-right corner. Click to start/stop continuous listening.
 * When wake-word mode is enabled (via Settings), only utterances starting with
 * the wake word ("Hey R2D2") fire as commands. Otherwise every utterance fires.
 *
 * Routes commands through `executeVoiceCommand` from r2d2-voice.ts.
 */
import { useEffect, useState } from "react";
import { Mic, MicOff, Volume2, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { useTTS } from "@/hooks/useTTS";
import { getWakeWordEnabled } from "@/lib/r2d2-settings";
import { executeVoiceCommand } from "@/lib/r2d2-voice";
import { logAction } from "@/lib/r2d2-tasks";
import { toast } from "sonner";

export function FloatingVoiceBubble() {
  const tts = useTTS();
  const [showHelp, setShowHelp] = useState(false);
  const [wake, setWake] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  // Read wake-word preference on mount + react to storage events.
  useEffect(() => {
    setWake(getWakeWordEnabled());
    const onStorage = () => setWake(getWakeWordEnabled());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const voice = useVoiceCommand({
    wakeWord: wake ? "hey r2d2" : "",
    onCommand: async (cmd) => {
      logAction("voice.command", cmd);
      const res = await executeVoiceCommand(cmd, {
        speak: (t) => tts.speak(t),
      });
      setLastResult(res.message);
      if (res.kind === "ok") toast.success("R2D2", { description: res.message });
      else toast.error("R2D2 couldn't run that", { description: res.message });
    },
  });

  if (!voice.supported) return null; // hide on unsupported browsers

  return (
    <>
      {/* Live transcript bubble */}
      {voice.listening && (voice.partial || voice.transcript) && (
        <div className="fixed bottom-28 right-6 z-40 max-w-sm animate-fade-in rounded-2xl border border-primary/40 bg-card/90 px-4 py-3 text-sm shadow-elevated backdrop-blur-xl">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary/80">
            {wake ? "Waiting for “Hey R2D2”…" : "Listening"}
          </div>
          <div className="mt-1 leading-snug">
            {voice.partial || voice.transcript}
          </div>
          {lastResult && (
            <div className="mt-2 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              ↳ {lastResult}
            </div>
          )}
        </div>
      )}

      {/* Help modal */}
      {showHelp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowHelp(false)}
        >
          <div
            className="relative max-w-md rounded-2xl border border-border/60 bg-card p-6 shadow-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowHelp(false)}
              className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            <h3 className="text-lg font-semibold">Voice commands</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {wake
                ? "Wake word mode: prefix every command with “Hey R2D2”."
                : "Continuous mode: every utterance fires as a command."}
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <CmdRow label="Open Spotify" desc="Opens Spotify in a new tab" />
              <CmdRow label="Search for lo-fi" desc="Runs a Google search" />
              <CmdRow label="Read me the latest reply" desc="Speaks aloud via ElevenLabs" />
              <CmdRow label="Add task organize my downloads" desc="Adds to local task queue" />
              <CmdRow label="Remember I prefer concise answers" desc="Stores a memory" />
              <CmdRow label="Stop" desc="Halts the current speech / task" />
              <CmdRow label="What are you doing?" desc="R2D2 narrates its current state" />
            </ul>
          </div>
        </div>
      )}

      {/* Floating mic button */}
      <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
        <Button
          size="icon"
          variant="outline"
          onClick={() => setShowHelp(true)}
          title="Voice command reference"
          className="size-10 rounded-full border-border/60 bg-card/80 backdrop-blur"
        >
          <HelpCircle className="size-4" />
        </Button>
        <button
          onClick={voice.toggle}
          title={voice.listening ? "Stop listening" : "Start listening"}
          className={cn(
            "group relative flex size-14 items-center justify-center rounded-full border transition-all",
            voice.listening
              ? "border-success/60 bg-gradient-to-br from-success to-primary text-success-foreground shadow-[0_0_30px_-4px_var(--color-success)]"
              : "border-border/60 bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_0_24px_-6px_var(--color-primary)]",
          )}
        >
          {voice.listening && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-success/40" />
              <span className="absolute -bottom-1 left-1/2 flex h-3 -translate-x-1/2 gap-0.5">
                <span className="w-0.5 animate-bounce rounded-full bg-success-foreground/80 [animation-delay:-0.3s]" />
                <span className="w-0.5 animate-bounce rounded-full bg-success-foreground/80 [animation-delay:-0.15s]" />
                <span className="w-0.5 animate-bounce rounded-full bg-success-foreground/80" />
              </span>
            </>
          )}
          {voice.listening ? <Mic className="size-5" /> : <MicOff className="size-5" />}
        </button>
        {tts.speaking && (
          <div className="rounded-full border border-accent/60 bg-card/80 p-2 shadow backdrop-blur">
            <Volume2 className="size-4 animate-pulse text-accent" />
          </div>
        )}
      </div>
    </>
  );
}

function CmdRow({ label, desc }: { label: string; desc: string }) {
  return (
    <li className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-secondary/30 px-3 py-2">
      <code className="text-xs font-semibold">{label}</code>
      <span className="text-right text-[11px] text-muted-foreground">{desc}</span>
    </li>
  );
}
