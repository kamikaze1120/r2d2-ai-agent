import { useEffect, useState } from "react";
import { api, type AutomationStatus } from "@/lib/r2d2-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Play, Save } from "lucide-react";
import { toast } from "sonner";

export function SafetyAndSchedulerCard() {
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [allowlistDraft, setAllowlistDraft] = useState("");
  const [thresholdDraft, setThresholdDraft] = useState<number>(0.8);
  const [loaded, setLoaded] = useState(false);

  const refresh = async () => {
    try {
      const s = await api.automationStatus();
      setStatus(s);
      if (!loaded) {
        setAllowlistDraft(s.action_allowlist.join(", "));
        setThresholdDraft(s.approval_threshold);
        setLoaded(true);
      }
    } catch (e) { toast.error((e as Error).message); }
  };

  useEffect(() => { refresh(); const t = window.setInterval(refresh, 8000);
    return () => window.clearInterval(t); }, []);

  if (!status) return null;

  const toggleDryRun = async (v: boolean) => {
    try { setStatus(await api.patchSafety({ dry_run: v }));
      toast.success(`Dry-run ${v ? "enabled" : "disabled"}`); }
    catch (e) { toast.error((e as Error).message); }
  };

  const saveThreshold = async () => {
    try { setStatus(await api.patchSafety({ approval_threshold: thresholdDraft }));
      toast.success("Threshold saved"); }
    catch (e) { toast.error((e as Error).message); }
  };

  const saveAllowlist = async () => {
    const items = allowlistDraft.split(",").map((s) => s.trim()).filter(Boolean);
    try { setStatus(await api.patchSafety({ action_allowlist: items }));
      toast.success("Allowlist saved"); }
    catch (e) { toast.error((e as Error).message); }
  };

  const trigger = async (name: string) => {
    try { await api.automationTrigger(name); toast.success(`Triggered ${name}`); }
    catch (e) { toast.error((e as Error).message); }
  };

  const updateInterval = async (name: string, hours: number) => {
    try { setStatus(await api.patchJob(name, { interval_seconds: Math.round(hours * 3600) }));
      toast.success("Schedule updated"); }
    catch (e) { toast.error((e as Error).message); }
  };

  const toggleJob = async (name: string, enabled: boolean) => {
    try { setStatus(await api.patchJob(name, { enabled }));
      toast.success(`${name} ${enabled ? "enabled" : "disabled"}`); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <>
      <Card className="space-y-4 p-4">
        <div>
          <h3 className="text-sm font-semibold">Safety controls</h3>
          <p className="text-xs text-muted-foreground">
            Restrict autonomous actions and require manual approval.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <Label className="cursor-pointer">Dry-run mode</Label>
            <p className="text-xs text-muted-foreground">
              Preview every external write without hitting Etsy/Shopify/Pinterest.
            </p>
          </div>
          <Switch checked={status.dry_run} onCheckedChange={toggleDryRun} />
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <div className="flex items-center justify-between">
            <Label>Approval confidence threshold</Label>
            <span className="text-sm font-medium">{(thresholdDraft * 100).toFixed(0)}%</span>
          </div>
          <Slider value={[thresholdDraft]} min={0} max={1} step={0.05}
                  onValueChange={(v) => setThresholdDraft(v[0])} />
          <p className="text-xs text-muted-foreground">
            Listings below this score queue for approval instead of auto-publishing.
          </p>
          <Button size="sm" onClick={saveThreshold}>
            <Save className="mr-1 size-3.5" /> Save threshold
          </Button>
        </div>

        <div className="space-y-2 rounded-md border border-border p-3">
          <Label htmlFor="allowlist">Action allowlist</Label>
          <Input id="allowlist" value={allowlistDraft}
                 onChange={(e) => setAllowlistDraft(e.target.value)}
                 placeholder="research, generate, draft (empty = all allowed)" />
          <p className="text-xs text-muted-foreground">
            Comma-separated prefixes. Tasks whose type matches none are blocked.
            Leave empty to allow everything.
          </p>
          <Button size="sm" onClick={saveAllowlist}>
            <Save className="mr-1 size-3.5" /> Save allowlist
          </Button>
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold">Scheduler</h3>
          <p className="text-xs text-muted-foreground">
            Automated jobs. Run manually or change cadence.
          </p>
        </div>
        <div className="space-y-2">
          {status.scheduler.jobs.map((j) => (
            <div key={j.name} className="space-y-2 rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{j.name}</div>
                  <div className="text-xs text-muted-foreground">
                    runs: {j.runs} · last: {j.last_run
                      ? new Date(j.last_run * 1000).toLocaleString() : "never"}
                    {j.last_error && (
                      <span className="text-destructive"> · {j.last_error}</span>
                    )}
                  </div>
                </div>
                <Switch checked={j.enabled}
                        onCheckedChange={(v) => toggleJob(j.name, v)} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Label className="text-xs">Every</Label>
                <Input className="h-8 w-24" type="number" step="0.5" min="0.05"
                       defaultValue={(j.interval_seconds / 3600).toFixed(2)}
                       onBlur={(e) => {
                         const h = parseFloat(e.target.value);
                         if (h > 0) updateInterval(j.name, h);
                       }} />
                <span className="text-xs text-muted-foreground">hours</span>
                <Button size="sm" variant="outline"
                        onClick={() => trigger(j.name)}>
                  <Play className="mr-1 size-3.5" /> Run now
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
