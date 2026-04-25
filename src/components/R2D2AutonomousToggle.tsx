import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useAutonomousR2D2 } from "@/hooks/useAutonomousR2D2";

/**
 * Header toggle for the proactive R2D2 persona.
 * When ON: R2D2 polls the audit log, speaks milestones, asks proactive
 * questions, and triggers scheduled business jobs.
 */
export function R2D2AutonomousToggle() {
  const { enabled, toggle } = useAutonomousR2D2();

  return (
    <Button
      size="sm"
      variant={enabled ? "default" : "outline"}
      onClick={toggle}
      className={cn(
        "h-8 gap-1.5 rounded-full border-border/60 transition-all",
        enabled
          ? "border-transparent bg-gradient-to-r from-accent to-primary text-accent-foreground shadow-[0_0_24px_-4px_var(--color-accent)] hover:opacity-95"
          : "bg-secondary/40 backdrop-blur hover:bg-secondary/70",
      )}
      title={
        enabled
          ? "Autonomous mode is ON — proactive prompts and audio narration"
          : "Turn on autonomous mode"
      }
    >
      <Sparkles className={cn("size-3.5", enabled && "animate-pulse")} />
      {enabled ? "R2D2: Live" : "R2D2"}
    </Button>
  );
}
