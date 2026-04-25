import { useEffect, useState } from "react";
import { api, type Task } from "@/lib/r2d2-api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Check, X, Pencil, Save } from "lucide-react";
import { toast } from "sonner";

type Listing = {
  title?: string; description?: string; tags?: string[];
  price_usd?: number; confidence?: number;
};

export function ApprovalsView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Listing>({});

  const refresh = async () => {
    try {
      const r = await api.listTasks({ status: "needs_approval", limit: 100 });
      setTasks(r.tasks);
      setError(null);
    } catch (e) { setError((e as Error).message); }
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 4000);
    return () => clearInterval(t);
  }, []);

  const decide = async (id: string, ok: boolean) => {
    try {
      ok ? await api.approveTask(id) : await api.rejectTask(id);
      toast.success(ok ? "Approved" : "Rejected");
      setEditing(null);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  const startEdit = (t: Task, preview: Listing) => {
    setEditing(t.id);
    setDraft({
      title: preview.title ?? "",
      description: preview.description ?? "",
      tags: preview.tags ?? [],
      price_usd: preview.price_usd ?? 0,
    });
  };

  const saveEdit = async (t: Task) => {
    const productId = (t.payload as { product_id?: string })?.product_id;
    if (!productId) {
      toast.error("Task has no product_id");
      return;
    }
    try {
      await api.patchListing(productId, {
        title: draft.title,
        description: draft.description,
        tags: draft.tags,
        price_usd: draft.price_usd,
      });
      toast.success("Listing updated");
      setEditing(null);
      refresh();
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Approvals</h1>
        <p className="text-sm text-muted-foreground">
          Tasks below the confidence threshold are queued here for review.
          Edit the listing inline before approving.
        </p>
      </div>

      {error && (
        <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Pending approval ({tasks.length})</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {tasks.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">Nothing waiting. Nice.</div>
            )}
            {tasks.map((t) => {
              const result = (typeof t.result === "object" ? t.result : null) as
                | { reason?: string; listing_preview?: Listing }
                | null;
              const preview = result?.listing_preview ?? {};
              const isEditing = editing === t.id;
              return (
                <div key={t.id} className="space-y-3 p-4 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">{t.type}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.confidence != null && `confidence ${(t.confidence * 100).toFixed(0)}% · `}
                        {result?.reason}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {!isEditing && (
                        <Button size="sm" variant="ghost" onClick={() => startEdit(t, preview)}>
                          <Pencil className="mr-1 size-3.5" /> Edit
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => decide(t.id, false)}>
                        <X className="mr-1 size-3.5" /> Reject
                      </Button>
                      <Button size="sm" onClick={() => decide(t.id, true)}>
                        <Check className="mr-1 size-3.5" /> Approve
                      </Button>
                    </div>
                  </div>

                  {!isEditing && preview && (
                    <div className="rounded-md border border-border bg-muted/30 p-3">
                      <div className="font-medium">{preview.title}</div>
                      {preview.price_usd != null && (
                        <div className="text-xs text-muted-foreground">${preview.price_usd}</div>
                      )}
                      <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-xs">{preview.description}</p>
                      {preview.tags && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {preview.tags.map((tag) => (
                            <span key={tag} className="rounded bg-background px-1.5 py-0.5 text-[10px]">{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {isEditing && (
                    <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
                      <div className="space-y-1">
                        <Label htmlFor={`t-${t.id}`} className="text-xs">Title</Label>
                        <Input id={`t-${t.id}`} value={draft.title ?? ""}
                               onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Price (USD)</Label>
                          <Input type="number" step="0.01" value={draft.price_usd ?? 0}
                                 onChange={(e) => setDraft({ ...draft, price_usd: parseFloat(e.target.value) || 0 })} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Tags (comma)</Label>
                          <Input value={(draft.tags ?? []).join(", ")}
                                 onChange={(e) => setDraft({ ...draft,
                                   tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Textarea rows={6} value={draft.description ?? ""}
                                  onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button size="sm" onClick={() => saveEdit(t)}>
                          <Save className="mr-1 size-3.5" /> Save
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
