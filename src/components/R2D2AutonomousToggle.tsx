import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useAutonomousR2D2 } from "@/hooks/useAutonomousR2D2";

/**
 * Header toggle for the proactive R2D2 persona.
 *
 * NOTE on SSR: `useAutonomousR2D2` reads from localStorage during render which
 * causes a hydration mismatch when the server-rendered HTML doesn't match the
 * client. We render a neutral placeholder during SSR and the first client
 * paint, then swap to the real state after `useEffect` runs.
 */
export function R2D2AutonomousToggle() {
  const { enabled, toggle } = useAutonomousR2D2();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // SSR / first-paint: render neutral state to match server output.
  const showActive = isMounted && enabled;
  const title = isMounted
    ? showActive
      ? "Autonomous mode is ON — proactive prompts and audio narration"
      : "Turn on autonomous mode"
    : "Turn on autonomous mode";

  return (
    <Button
      size="sm"
      variant={showActive ? "default" : "outline"}
      onClick={isMounted ? toggle : undefined}
      className={cn(
        "h-8 gap-1.5 rounded-full border-border/60 transition-all",
        showActive
          ? "border-transparent bg-gradient-to-r from-accent to-primary text-accent-foreground shadow-[0_0_24px_-4px_var(--color-accent)] hover:opacity-95"
          : "bg-secondary/40 backdrop-blur hover:bg-secondary/70",
      )}
      title={title}
    >
      <Sparkles className={cn("size-3.5", showActive && "animate-pulse")} />
      {showActive ? "R2D2: Live" : "R2D2"}
    </Button>
  );
}
