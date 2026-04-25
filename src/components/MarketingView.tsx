import { useEffect, useState } from "react";
import { api, type MarketingItem } from "@/lib/r2d2-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";

type Kind = "pinterest" | "tiktok";

export function MarketingView() {
  const [tab, setTab] = useState<Kind>("pinterest");
  const [items, setItems] = useState<MarketingItem[]>([]);
  const [pinConfigured, setPinConfigured] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (kind: Kind) => {
    try {
      const r = await api.marketingQueue(kind);
      setItems(r.items);
      setPinConfigured(r.pinterest_configured);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  };

  useEffect(() => { load(tab); const t = setInterval(() => load(tab), 6000);
    return () => clearInterval(t); }, [tab]);

  const markPosted = async (id: string) => {
    try { await api.marketingMarkPosted(tab, id); toast.success("Marked posted"); load(tab); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Marketing queue</h1>
        <p className="text-sm text-muted-foreground">
          Pinterest pins post automatically when configured; TikTok scripts
          always queue here for manual posting.
        </p>
      </div>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Kind)}>
        <TabsList>
          <TabsTrigger value="pinterest">
            Pinterest {pinConfigured && <Badge variant="outline" className="ml-2">auto-post</Badge>}
          </TabsTrigger>
          <TabsTrigger value="tiktok">TikTok</TabsTrigger>
        </TabsList>

        <TabsContent value="pinterest">
          <QueueList items={items} kind="pinterest" onPosted={markPosted} />
        </TabsContent>
        <TabsContent value="tiktok">
          <QueueList items={items} kind="tiktok" onPosted={markPosted} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function QueueList({ items, kind, onPosted }: {
  items: MarketingItem[]; kind: Kind; onPosted: (id: string) => void;
}) {
  if (items.length === 0) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">
      Queue is empty. Marketing assets are generated after a product publishes.
    </CardContent></Card>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((it) => (
        <Card key={it.id} className={it.status === "posted" ? "opacity-60" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between text-sm">
              <span className="truncate">{it.title || it.hook || "Untitled"}</span>
              <Badge variant={it.status === "posted" ? "outline" : "default"}>
                {it.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {kind === "pinterest" ? (
              <>
                <p className="whitespace-pre-wrap text-xs">{it.description}</p>
                {it.hashtags && (
                  <div className="flex flex-wrap gap-1">
                    {it.hashtags.map((h) => (
                      <span key={h} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{h}</span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div><span className="font-medium">Hook:</span> {it.hook}</div>
                {it.beats && (
                  <ol className="ml-4 list-decimal text-xs text-muted-foreground">
                    {it.beats.map((b, i) => <li key={i}>{b}</li>)}
                  </ol>
                )}
                <div className="text-xs"><span className="font-medium">CTA:</span> {it.cta}</div>
              </>
            )}
            {it.status !== "posted" && (
              <Button size="sm" variant="outline" onClick={() => onPosted(it.id)}>
                <CheckCheck className="mr-1 size-3.5" /> Mark posted
              </Button>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
