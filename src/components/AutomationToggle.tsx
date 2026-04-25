import { useEffect, useState } from "react";
import { api, type AutomationStatus } from "@/lib/r2d2-api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Power, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AutomationToggle() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    try { setStatus(await api.automationStatus()); } catch { /* offline */ }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const on = !!status?.worker.alive;

  const toggle = async () => {
    setBusy(true);
    try {
      const next = on ? await api.automationStop() : await api.automationStart();
      setStatus(next);
      toast.success(on ? "Automation stopped" : "Automation started");
    } catch (e) {
      toast.error(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      size="sm"
      variant={on ? "default" : "outline"}
      onClick={toggle}
      disabled={busy || !status}
      className={cn(
        "h-8 gap-1.5 rounded-full border-border/60 transition-all",
        on
          ? "border-transparent bg-gradient-to-r from-success to-success/80 text-success-foreground shadow-[0_0_24px_-4px_var(--color-success)] hover:opacity-95"
          : "bg-secondary/40 backdrop-blur hover:bg-secondary/70",
      )}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Power className="size-3.5" />}
      {on ? "Auto: ON" : "Auto: OFF"}
    </Button>
  );
}
