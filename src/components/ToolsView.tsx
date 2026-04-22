import { useEffect, useState } from "react";
import { api, type ToolSpec } from "@/lib/r2d2-api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wrench, AlertCircle } from "lucide-react";

export function ToolsView() {
  const [tools, setTools] = useState<ToolSpec[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.listTools()
      .then((r) => setTools(r.tools))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));
  }, []);

  if (err) {
    return (
      <Card className="flex items-start gap-2 border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <AlertCircle className="size-4" /> {err}
      </Card>
    );
  }
  if (!tools) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading tools…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Tools</h1>
        <p className="text-sm text-muted-foreground">
          Capabilities R2D2 can use. Add new ones in{" "}
          <code className="rounded bg-secondary px-1 py-0.5 text-xs">r2d2/tools.py</code>.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {tools.map((t) => (
          <Card key={t.name} className="space-y-2 p-4">
            <div className="flex items-center gap-2">
              <Wrench className="size-4 text-primary" />
              <h3 className="font-mono text-sm font-semibold">{t.name}</h3>
            </div>
            <p className="text-sm text-muted-foreground">{t.description}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {Object.entries(t.parameters.properties || {}).map(([key, val]) => (
                <Badge key={key} variant="secondary" className="font-mono text-xs">
                  {key}: {val.type}
                </Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
