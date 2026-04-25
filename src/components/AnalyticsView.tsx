import { useEffect, useState } from "react";
import { api, type AnalyticsOverview } from "@/lib/r2d2-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AnalyticsView() {
  const [data, setData] = useState<AnalyticsOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try { setData(await api.analyticsOverview(30)); setError(null); }
      catch (e) { setError((e as Error).message); }
    };
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const dailyMax = data ? Math.max(1, ...data.daily.map((d) => d.revenue)) : 1;
  const nicheMax = data ? Math.max(1, ...data.by_niche.map((n) => n.revenue)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Revenue analytics</h1>
        <p className="text-sm text-muted-foreground">
          30-day rolling. Backed by SQLite events table — fed by daily platform sync.
        </p>
      </div>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Revenue (30d)" value={`$${data.overview.revenue.toFixed(2)}`} />
            <Stat label="Sales" value={data.overview.sales.toString()} />
            <Stat label="Views" value={data.overview.views.toString()} />
            <Stat label="Conversion" value={`${(data.overview.conversion * 100).toFixed(2)}%`} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Funnel</CardTitle></CardHeader>
            <CardContent>
              <Funnel f={data.funnel} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Daily revenue</CardTitle></CardHeader>
            <CardContent>
              {data.daily.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No events recorded yet. Sync platform analytics to populate.
                </div>
              ) : (
                <div className="flex h-40 items-end gap-1">
                  {data.daily.map((d) => (
                    <div
                      key={d.day}
                      title={`$${d.revenue.toFixed(2)} · ${d.views} views`}
                      className="flex-1 rounded-t bg-primary/70 hover:bg-primary"
                      style={{ height: `${(d.revenue / dailyMax) * 100}%` }}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Revenue by niche</CardTitle></CardHeader>
            <CardContent>
              {data.by_niche.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No per-niche revenue yet.
                </div>
              ) : (
                <ul className="space-y-2">
                  {data.by_niche.map((n) => (
                    <li key={n.niche_id} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate font-medium">{n.name}</span>
                        <span className="text-muted-foreground">
                          ${n.revenue.toFixed(2)} · {n.sales} sales · {n.views} views
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded bg-muted">
                        <div className="h-full bg-primary"
                             style={{ width: `${(n.revenue / nicheMax) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs uppercase text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Funnel({ f }: { f: AnalyticsOverview["funnel"] }) {
  const steps = [
    { label: "Views", value: f.views },
    { label: "Favorites", value: f.favorites },
    { label: "Sales", value: f.sales },
  ];
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <div className="space-y-2">
      {steps.map((s, i) => {
        const prev = i > 0 ? steps[i - 1].value : null;
        const drop = prev && prev > 0
          ? ` · ${((s.value / prev) * 100).toFixed(1)}% from prior`
          : "";
        return (
          <div key={s.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{s.label}</span>
              <span className="text-muted-foreground">
                {s.value.toLocaleString()}{drop}
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded bg-muted">
              <div className="h-full bg-primary"
                   style={{ width: `${(s.value / max) * 100}%` }} />
            </div>
          </div>
        );
      })}
      <div className="pt-2 text-xs text-muted-foreground">
        Revenue: <span className="font-medium text-foreground">${f.revenue.toFixed(2)}</span>
      </div>
    </div>
  );
}
