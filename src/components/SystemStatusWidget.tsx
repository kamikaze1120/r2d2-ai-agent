/**
 * Collapsible "System Status" widget for the cockpit sidebar/main column.
 * Shows JS heap, Lite mode, current model, last latency and conversation tokens.
 */
import { useEffect, useState } from "react";
import { ChevronDown, Cpu, Gauge, Hash, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSystemStatus } from "@/hooks/useSystemStatus";
import { getLiteMode, setLiteMode } from "@/lib/r2d2-settings";
import { Switch } from "@/components/ui/switch";
import { getModel } from "@/lib/r2d2-api";

export function SystemStatusWidget() {
  const [open, setOpen] = useState(true);
  const [lite, setLite] = useState(false);
  const [model, setModel] = useState("");
  const { usedMB, limitMB, pctUsed, lastLatency, tokenCount } = useSystemStatus();

  useEffect(() => {
    setLite(getLiteMode());
    setModel(getModel() || "(server default)");
  }, []);

  return (
    <div className="rounded-xl border border-border/60 bg-card/60 backdrop-blur">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-t-xl px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-secondary/40"
      >
        <span className="flex items-center gap-1.5">
          <Gauge className="size-3.5" /> System
        </span>
        <ChevronDown
          className={cn("size-3.5 transition-transform", open ? "" : "-rotate-90")}
        />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3 text-xs">
          <Row icon={<Cpu className="size-3" />} label="Model" value={model} />
          {pctUsed != null && (
            <div>
              <Row
                icon={<Gauge className="size-3" />}
                label="JS heap"
                value={`${usedMB}/${limitMB} MB`}
              />
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary/60">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pctUsed > 80
                      ? "bg-destructive"
                      : pctUsed > 60
                        ? "bg-warning"
                        : "bg-primary",
                  )}
                  style={{ width: `${Math.min(100, pctUsed)}%` }}
                />
              </div>
            </div>
          )}
          <Row
            icon={<Zap className="size-3" />}
            label="Last latency"
            value={lastLatency ? `${lastLatency} ms` : "—"}
          />
          <Row
            icon={<Hash className="size-3" />}
            label="Conv. tokens"
            value={tokenCount ? tokenCount.toLocaleString() : "—"}
          />
          <div className="flex items-center justify-between rounded border border-border/60 bg-secondary/30 px-2 py-1.5">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="size-3" /> Lite mode
            </span>
            <Switch
              checked={lite}
              onCheckedChange={(v) => {
                setLite(v);
                setLiteMode(v);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon} {label}
      </span>
      <span className="truncate font-mono text-foreground">{value}</span>
    </div>
  );
}
