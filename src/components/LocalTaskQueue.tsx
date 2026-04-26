/**
 * In-browser autonomous task queue.
 * Lets the user type a goal, see R2D2's plan, then execute steps using the
 * browser File System Access API and `window.open` for app launching.
 */
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Play,
  Trash2,
  CheckCircle2,
  Loader2,
  Circle,
  XCircle,
  FolderPlus,
  Terminal,
  History,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  appendOutput,
  createTask,
  deleteTask,
  loadActionLog,
  loadTasks,
  logAction,
  openTarget,
  planLocally,
  type R2D2LocalTask,
  type R2D2TaskStatus,
  updateSubtask,
  updateTask,
} from "@/lib/r2d2-tasks";
import { grantFolder, isFileSystemAccessSupported, listGrantedFolders } from "@/lib/r2d2-fs";

const STATUS_ICON = (s: R2D2TaskStatus) => {
  switch (s) {
    case "pending":
      return <Circle className="size-3.5 text-muted-foreground" />;
    case "running":
      return <Loader2 className="size-3.5 animate-spin text-primary" />;
    case "done":
      return <CheckCircle2 className="size-3.5 text-success" />;
    case "failed":
      return <XCircle className="size-3.5 text-destructive" />;
  }
};

export function LocalTaskQueue() {
  const [goal, setGoal] = useState("");
  const [tasks, setTasks] = useState<R2D2LocalTask[]>([]);
  const [folders, setFolders] = useState(listGrantedFolders());
  const [log, setLog] = useState(loadActionLog());

  const refresh = () => {
    setTasks(loadTasks());
    setLog(loadActionLog());
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, []);

  const fsSupported = useMemo(() => isFileSystemAccessSupported(), []);

  const onPlan = () => {
    const g = goal.trim();
    if (!g) return;
    const subs = planLocally(g);
    const t = createTask(g, subs);
    logAction("task.created", g);
    setGoal("");
    refresh();
    toast.success("Plan ready", { description: `${subs.length} steps queued.` });
    return t;
  };

  const onExecute = async (t: R2D2LocalTask) => {
    updateTask(t.id, { status: "running" });
    appendOutput(t.id, `▶ Starting: ${t.goal}`);
    refresh();

    for (const s of t.subtasks) {
      updateSubtask(t.id, s.id, { status: "running" });
      appendOutput(t.id, `  • ${s.text}`);
      refresh();

      // Naive executor: only "open X" actually does something.
      const lower = s.text.toLowerCase();
      try {
        if (lower.startsWith("open ") || lower.includes("open it")) {
          const target = t.goal.replace(/^open\s+/i, "");
          const r = openTarget(target);
          if (r.ok) {
            appendOutput(t.id, `    ✓ Opened ${r.url}`);
            logAction("browser.open", r.url);
            updateSubtask(t.id, s.id, { status: "done", output: r.url });
          } else {
            updateSubtask(t.id, s.id, { status: "failed", output: r.reason });
          }
        } else {
          // Simulated work
          await new Promise((res) => setTimeout(res, 600));
          updateSubtask(t.id, s.id, { status: "done" });
          appendOutput(t.id, `    ✓ done`);
        }
      } catch (e) {
        updateSubtask(t.id, s.id, {
          status: "failed",
          output: e instanceof Error ? e.message : String(e),
        });
        appendOutput(t.id, `    ✗ failed`);
      }
      refresh();
    }

    updateTask(t.id, { status: "done" });
    appendOutput(t.id, `✔ Goal complete`);
    logAction("task.done", t.goal);
    refresh();
    toast.success("Task finished", { description: t.goal });
  };

  const onGrantFolder = async () => {
    try {
      const f = await grantFolder();
      if (f) {
        setFolders(listGrantedFolders());
        logAction("fs.grant", f.name);
        toast.success("Folder access granted", { description: f.name });
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Plan input */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4 text-primary" /> New goal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder='e.g. "Open YouTube" or "Find all PDFs from last week"'
              onKeyDown={(e) => {
                if (e.key === "Enter") onPlan();
              }}
            />
            <Button onClick={onPlan} disabled={!goal.trim()}>
              <Play className="size-4" /> Plan
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">Try: Open Spotify</Badge>
            <Badge variant="secondary">Try: Organize Downloads folder</Badge>
            <Badge variant="secondary">Try: Find all PDFs</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Folder access */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FolderPlus className="size-4 text-accent" /> Folder access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!fsSupported ? (
            <p className="text-xs text-muted-foreground">
              File System Access requires Chrome or Edge on desktop.
            </p>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={onGrantFolder}>
                <FolderPlus className="size-4" /> Grant folder
              </Button>
              {folders.length > 0 ? (
                <ul className="space-y-1 text-xs">
                  {folders.map((f) => (
                    <li
                      key={f.name + f.grantedAt}
                      className="flex items-center justify-between rounded border border-border/60 bg-secondary/30 px-2 py-1"
                    >
                      <span className="font-mono">{f.name}</span>
                      <span className="text-muted-foreground">
                        {new Date(f.grantedAt).toLocaleTimeString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No folders granted yet.</p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Tasks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Local task queue</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {tasks.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              No local tasks yet. Plan a goal above.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {tasks.map((t) => (
                <li key={t.id} className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] uppercase",
                            t.status === "done" && "bg-success/15 text-success",
                            t.status === "running" && "bg-primary/15 text-primary",
                            t.status === "failed" && "bg-destructive/15 text-destructive",
                            t.status === "pending" && "bg-muted text-foreground",
                          )}
                        >
                          {t.status}
                        </span>
                        <span className="truncate font-medium">{t.goal}</span>
                      </div>
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(t.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {t.status !== "running" && t.status !== "done" && (
                        <Button size="sm" variant="default" onClick={() => onExecute(t)}>
                          <Play className="size-3.5" /> Run
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          deleteTask(t.id);
                          refresh();
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <ul className="ml-2 space-y-0.5 text-xs">
                    {t.subtasks.map((s, i) => (
                      <li key={s.id} className="flex items-center gap-2">
                        {STATUS_ICON(s.status)}
                        <span className="text-muted-foreground">[{i + 1}]</span>
                        <span>{s.text}</span>
                      </li>
                    ))}
                  </ul>
                  {t.output.length > 0 && (
                    <pre className="rounded bg-secondary/40 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground max-h-32 overflow-auto">
                      {t.output.join("\n")}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Action log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" /> Action log
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-48">
            <ul className="divide-y divide-border text-xs">
              {log.length === 0 && (
                <li className="p-3 text-muted-foreground">No actions yet.</li>
              )}
              {log.map((e) => (
                <li key={e.id} className="flex items-center gap-2 p-2 font-mono">
                  <Terminal className="size-3 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {new Date(e.ts).toLocaleTimeString()}
                  </span>
                  <span className="font-semibold">{e.action}</span>
                  {e.detail && <span className="truncate text-muted-foreground">{e.detail}</span>}
                </li>
              ))}
            </ul>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
