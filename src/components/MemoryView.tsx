import { useEffect, useState } from "react";
import { api, type Memory } from "@/lib/r2d2-api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Brain, AlertCircle } from "lucide-react";

export function MemoryView() {
  const [items, setItems] = useState<Memory[] | null>(null);
  const [text, setText] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const refresh = () =>
    api.listMemories()
      .then((r) => setItems(r.memories))
      .catch((e) => setErr(e instanceof Error ? e.message : String(e)));

  useEffect(() => {
    refresh();
  }, []);

  const add = async () => {
    if (!text.trim()) return;
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    try {
      await api.addMemory(text.trim(), tags);
      setText("");
      setTagsInput("");
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const remove = async (id: string) => {
    await api.deleteMemory(id);
    refresh();
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Long-term memory</h1>
        <p className="text-sm text-muted-foreground">
          Facts R2D2 can recall across sessions. Stored locally in JSON.
        </p>
      </div>

      <Card className="space-y-2 p-4">
        <Input
          placeholder="A fact, preference, or note R2D2 should remember…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2">
          <Input
            placeholder="tags (comma separated, optional)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
          />
          <Button onClick={add} disabled={!text.trim()}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </Card>

      {err && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="size-4" /> {err}
        </div>
      )}

      <div className="space-y-2">
        {items === null && <p className="text-sm text-muted-foreground">Loading…</p>}
        {items && items.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <Brain className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No memories yet</p>
          </Card>
        )}
        {items?.map((m) => (
          <Card key={m.id} className="flex items-start justify-between gap-2 p-3">
            <div className="space-y-1">
              <p className="text-sm">{m.text}</p>
              <div className="flex flex-wrap gap-1">
                {m.tags.map((t) => (
                  <span
                    key={t}
                    className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
                  >
                    #{t}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => remove(m.id)}
              className="text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="size-4" />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}
