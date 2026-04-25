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

  const max = data ? Math.max(1, ...data.daily.map((d) => d.revenue)) : 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Revenue analytics</h1>
        <p className="text-sm text-muted-foreground">
          30-day rolling. Backed by SQLite events table — fed by platform sync jobs.
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
                      style={{ height: `${(d.revenue / max) * 100}%` }}
                    />
                  ))}
                </div>
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
