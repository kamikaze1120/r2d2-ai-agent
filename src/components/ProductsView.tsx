import { useEffect, useState } from "react";
import { api, type Product, type Niche } from "@/lib/r2d2-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";

export function ProductsView() {
  const [products, setProducts] = useState<Product[]>([]);
  const [niches, setNiches] = useState<Niche[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [p, n] = await Promise.all([api.listProducts(), api.listNiches()]);
      setProducts(p.products);
      setNiches(n.niches);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const nicheMap = Object.fromEntries(niches.map((n) => [n.id, n]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Products & niches</h1>
        <p className="text-sm text-muted-foreground">
          Generated assets, listing copy, performance metrics.
        </p>
      </div>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Niches ({niches.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2 p-3">
            {niches.length === 0 && (
              <div className="text-sm text-muted-foreground">No niches yet. Trigger research from the Tasks page.</div>
            )}
            {niches.map((n) => (
              <div key={n.id} className="rounded-md border border-border p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{n.name}</span>
                  <Badge variant="outline">{(n.score * 100).toFixed(0)}</Badge>
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {n.keywords.join(", ")}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Products ({products.length})</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {products.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">No products yet.</div>
              )}
              {products.map((p) => {
                const niche = nicheMap[p.niche_id];
                const listing = p.metadata?.listing || p.listing;
                return (
                  <div key={p.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{listing?.title || p.title}</span>
                        <Badge variant="outline" className="text-xs">{p.product_type}</Badge>
                        <Badge className="text-xs">{p.status}</Badge>
                        {niche && <span className="text-xs text-muted-foreground">{niche.name}</span>}
                      </div>
                      {listing?.tags && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {listing.tags.slice(0, 8).map((t) => (
                            <span key={t} className="rounded bg-secondary px-1.5 py-0.5 text-[10px]">{t}</span>
                          ))}
                        </div>
                      )}
                      {p.metrics && (
                        <div className="mt-1 text-xs text-muted-foreground">
                          {p.metrics.views} views · {p.metrics.sales} sales · ${p.metrics.revenue.toFixed(2)} ·
                          {" "}{(p.metrics.conversion * 100).toFixed(2)}% conv
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      {p.file_path && (
                        <a href={api.productFileUrl(p.id)} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="outline" className="h-7 gap-1">
                            <Download className="size-3" /> File
                          </Button>
                        </a>
                      )}
                      {p.platform_ids?.etsy && (
                        <a href={`https://www.etsy.com/listing/${p.platform_ids.etsy}`} target="_blank" rel="noreferrer">
                          <Button size="sm" variant="ghost" className="h-7 gap-1">
                            <ExternalLink className="size-3" /> Etsy
                          </Button>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
