/**
 * R2D2 status avatar — circular indicator showing the agent's current state.
 *  🔵 idle  🟢 listening  🟡 thinking  🔴 executing
 */
import { cn } from "@/lib/utils";
import { Mic, Loader2, Zap, Circle } from "lucide-react";

export type R2D2Status = "idle" | "listening" | "thinking" | "executing";

const STATE = {
  idle: {
    color: "bg-primary",
    ring: "ring-primary/40",
    Icon: Circle,
    label: "Idle",
  },
  listening: {
    color: "bg-success",
    ring: "ring-success/50",
    Icon: Mic,
    label: "Listening",
  },
  thinking: {
    color: "bg-warning",
    ring: "ring-warning/50",
    Icon: Loader2,
    label: "Thinking",
  },
  executing: {
    color: "bg-destructive",
    ring: "ring-destructive/50",
    Icon: Zap,
    label: "Executing",
  },
} as const;

export function R2D2StatusAvatar({
  status = "idle",
  size = 40,
  showLabel = false,
}: {
  status?: R2D2Status;
  size?: number;
  showLabel?: boolean;
}) {
  const s = STATE[status];
  const Icon = s.Icon;
  const animate = status === "thinking" || status === "listening" || status === "executing";
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "relative flex items-center justify-center rounded-full ring-2",
          s.ring,
        )}
        style={{ width: size, height: size }}
        title={s.label}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-full opacity-20",
            s.color,
          )}
        />
        {animate && (
          <span
            className={cn(
              "absolute inset-0 animate-ping rounded-full opacity-30",
              s.color,
            )}
          />
        )}
        <Icon
          className={cn(
            "relative",
            status === "thinking" && "animate-spin",
          )}
          style={{ width: size * 0.5, height: size * 0.5 }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {s.label}
        </span>
      )}
    </div>
  );
}
