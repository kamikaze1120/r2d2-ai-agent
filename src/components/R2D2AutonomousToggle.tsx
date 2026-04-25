import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { useAutonomousJarvis } from "@/hooks/useAutonomousJarvis";

/**
 * Header toggle for the proactive JARVIS persona.
 * When ON: R2D2 polls the audit log, speaks milestones, asks proactive
 * questions, and triggers scheduled business jobs.
 */
export function JarvisAutonomousToggle() {
  const { enabled, toggle } = useAutonomousJarvis();

  return (
    <Button
      size="sm"
      variant={enabled ? "default" : "outline"}
      onClick={toggle}
      className={cn(
        "h-8 gap-1.5",
        enabled &&
          "bg-accent text-accent-foreground hover:bg-accent/90 shadow-[0_0_20px_-4px_var(--color-accent)]",
      )}
      title={
        enabled
          ? "Autonomous JARVIS is ON — proactive prompts and audio narration"
          : "Turn on autonomous JARVIS"
      }
    >
      <Sparkles className={cn("size-3.5", enabled && "animate-pulse")} />
      {enabled ? "JARVIS: Live" : "JARVIS"}
    </Button>
  );
}
