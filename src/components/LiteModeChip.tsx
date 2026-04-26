/**
 * Small "⚡ Lite Mode" chip displayed in the header when lightweight mode is on.
 * Polls localStorage every 2s so it reflects toggle changes from other panels.
 */
import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { getLiteMode } from "@/lib/r2d2-settings";

export function LiteModeChip() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const tick = () => setOn(getLiteMode());
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, []);

  if (!on) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning"
      title="Lightweight mode is active — narration muted, context trimmed"
    >
      <Zap className="size-3" /> Lite
    </span>
  );
}
