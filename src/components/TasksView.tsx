import { useEffect, useState } from "react";
import { api, type Task, type TaskStats } from "@/lib/r2d2-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Trash2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { LocalTaskQueue } from "@/components/LocalTaskQueue";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-muted text-foreground",
  running: "bg-primary/15 text-primary",
  completed: "bg-success/15 text-success",
  failed: "bg-destructive/15 text-destructive",
  needs_approval: "bg-warning/15 text-warning",
};

export function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const r = await api.listTasks({ status: filter || undefined, limit: 200 });
      setTasks(r.tasks);
      setStats(r.stats);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  const seedDailyRun = async () => {
    try {
      await api.createTask({
        type: "research_niches",
        agent: "research_agent",
        payload: { limit: 5 },
        priority: 9,
      });
      toast.success("Queued: research_niches");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const del = async (id: string) => {
    await api.deleteTask(id);
    refresh();
  };

  return (
    <div className="space-y-8">
      {/* In-browser autonomous queue */}
      <LocalTaskQueue />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-6">
        <div>
          <h1 className="text-2xl font-semibold">Agent task queue</h1>
          <p className="text-sm text-muted-foreground">
            Persistent, restart-safe. Worker claims tasks atomically.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={refresh}>
            <RefreshCw className="mr-1.5 size-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={seedDailyRun}>
            <Play className="mr-1.5 size-3.5" /> Trigger research
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {(["total", "pending", "running", "needs_approval", "completed", "failed"] as const).map((k) => (
            <Card key={k}>
              <CardContent className="p-4">
                <div className="text-xs uppercase text-muted-foreground">{k.replace("_", " ")}</div>
                <div className="text-2xl font-semibold">{stats[k]}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {["", "pending", "running", "needs_approval", "completed", "failed"].map((s) => (
          <Button
            key={s || "all"}
            size="sm"
            variant={filter === s ? "default" : "outline"}
            onClick={() => setFilter(s)}
          >
            {s || "all"}
          </Button>
        ))}
      </div>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent tasks</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {tasks.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No tasks yet.</div>
            )}
            {tasks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-4 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", STATUS_COLOR[t.status])}>
                      {t.status}
                    </span>
                    <span className="font-medium">{t.type}</span>
                    {t.agent && <Badge variant="secondary" className="text-xs">{t.agent}</Badge>}
                    {t.confidence != null && (
                      <span className="text-xs text-muted-foreground">
                        conf {(t.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {JSON.stringify(t.payload)} · attempts {t.attempts}/{t.max_attempts}
                  </div>
                  {t.error && (
                    <div className="mt-1 text-xs text-destructive">err: {t.error}</div>
                  )}
                </div>
                <Button size="icon" variant="ghost" onClick={() => del(t.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
