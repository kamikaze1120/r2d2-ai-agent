import { useEffect, useState } from "react";
import { api, type AuditEntry } from "@/lib/r2d2-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const OUTCOMES = ["", "ok", "blocked", "dry_run", "error"] as const;

export function AuditView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      try {
        const r = await api.audit({
          limit: 300,
          action: actionFilter || undefined,
          outcome: outcomeFilter || undefined,
        });
        setEntries(r.entries);
        setError(null);
      } catch (e) { setError((e as Error).message); }
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [actionFilter, outcomeFilter]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Audit log</h1>
        <p className="text-sm text-muted-foreground">
          Every meaningful action: agent runs, platform calls, approvals,
          dry-run blocks, scheduler fires.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input className="max-w-xs" placeholder="Filter by action prefix (e.g. etsy.)"
               value={actionFilter}
               onChange={(e) => setActionFilter(e.target.value)} />
        <select className="h-9 rounded-md border border-input bg-input px-3 text-sm"
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>{o ? `outcome: ${o}` : "any outcome"}</option>
          ))}
        </select>
      </div>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Entries ({entries.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border max-h-[60vh] overflow-y-auto">
            {entries.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">
                No entries match the current filter.
              </div>
            )}
            {entries.map((e) => (
              <div key={e.id} className="space-y-1 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={badgeVariant(e.outcome)}>{e.outcome}</Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {new Date(e.ts * 1000).toLocaleString()}
                  </span>
                  <span className="font-medium">{e.action}</span>
                  <span className="text-xs text-muted-foreground">
                    by {e.actor}{e.target ? ` · target ${e.target}` : ""}
                  </span>
                </div>
                {Object.keys(e.detail || {}).length > 0 && (
                  <pre className="overflow-x-auto rounded bg-muted/40 p-2 text-[11px]">
{JSON.stringify(e.detail, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function badgeVariant(o: AuditEntry["outcome"]):
  "default" | "secondary" | "destructive" | "outline" {
  switch (o) {
    case "ok": return "default";
    case "blocked": return "secondary";
    case "dry_run": return "outline";
    case "error": return "destructive";
    default: return "outline";
  }
}
