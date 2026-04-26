import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Brain,
  Trash2,
  Plus,
  NotebookPen,
  Save,
  Pencil,
  X,
  Check,
} from "lucide-react";
import {
  MEMORY_CATEGORIES,
  type MemoryCategory,
  type R2D2Memory,
  addMemory,
  deleteMemory,
  getScratchpad,
  loadMemories,
  setScratchpad,
  updateMemory,
} from "@/lib/r2d2-memory";
import { toast } from "sonner";

const CATEGORY_TONE: Record<MemoryCategory, string> = {
  preferences: "border-primary/40 bg-primary/10 text-primary",
  tasks: "border-accent/40 bg-accent/10 text-accent",
  files: "border-success/40 bg-success/10 text-success",
  people: "border-warning/40 bg-warning/10 text-warning",
  schedule: "border-destructive/40 bg-destructive/10 text-destructive",
  general: "border-muted-foreground/30 bg-muted/40 text-muted-foreground",
};

export function MemoryView() {
  const [items, setItems] = useState<R2D2Memory[]>([]);
  const [text, setText] = useState("");
  const [category, setCategory] = useState<MemoryCategory>("preferences");
  const [filter, setFilter] = useState<MemoryCategory | "all">("all");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [scratch, setScratch] = useState("");
  const [scratchSavedAt, setScratchSavedAt] = useState<number | null>(null);

  useEffect(() => {
    setItems(loadMemories());
    setScratch(getScratchpad());
  }, []);

  const refresh = () => setItems(loadMemories());

  const add = () => {
    if (!text.trim()) return;
    addMemory(text, category);
    setText("");
    refresh();
    toast.success("Memory saved", { description: `Added to “${category}”` });
  };

  const remove = (id: string) => {
    deleteMemory(id);
    refresh();
  };

  const startEdit = (m: R2D2Memory) => {
    setEditing(m.id);
    setEditText(m.fact);
  };

  const saveEdit = () => {
    if (!editing || !editText.trim()) return;
    updateMemory(editing, { fact: editText.trim() });
    setEditing(null);
    refresh();
    toast.success("Memory updated");
  };

  const saveScratch = () => {
    setScratchpad(scratch);
    setScratchSavedAt(Date.now());
    toast.success("Scratchpad saved");
  };

  const visible =
    filter === "all" ? items : items.filter((m) => m.category === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Memory & scratchpad</h1>
        <p className="text-sm text-muted-foreground">
          Facts R2D2 keeps in mind across every session. Stored in your browser.
          Memories are auto-injected into the prompt as context.
        </p>
      </div>

      {/* ---- Add memory ---- */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <Plus className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Add a memory</h2>
        </div>
        <Textarea
          rows={2}
          placeholder="e.g. I prefer concise responses with bullet points."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as MemoryCategory)}
            className="h-9 rounded-md border border-input bg-input px-3 text-sm"
          >
            {MEMORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <Button onClick={add} disabled={!text.trim()}>
            <Plus className="size-4" /> Save memory
          </Button>
        </div>
      </Card>

      {/* ---- Filter chips ---- */}
      <div className="flex flex-wrap gap-1.5">
        {(["all", ...MEMORY_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-all",
              filter === c
                ? "border-primary/60 bg-primary/15 text-primary"
                : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
            {c !== "all" && (
              <span className="ml-1.5 text-[10px] opacity-70">
                {items.filter((m) => m.category === c).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ---- Memory list ---- */}
      <div className="space-y-2">
        {visible.length === 0 && (
          <Card className="flex flex-col items-center gap-2 p-8 text-center">
            <Brain className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No memories yet.</p>
          </Card>
        )}
        {visible.map((m) => (
          <Card key={m.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0 flex-1 space-y-1">
              {editing === m.id ? (
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={2}
                  autoFocus
                />
              ) : (
                <p className="text-sm">{m.fact}</p>
              )}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant="outline"
                  className={cn("text-[10px]", CATEGORY_TONE[m.category])}
                >
                  {m.category}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(m.timestamp).toLocaleString()}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {editing === m.id ? (
                <>
                  <Button size="icon" variant="ghost" onClick={saveEdit}>
                    <Check className="size-4 text-success" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditing(null)}
                  >
                    <X className="size-4" />
                  </Button>
                </>
              ) : (
                <Button size="icon" variant="ghost" onClick={() => startEdit(m)}>
                  <Pencil className="size-4" />
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => remove(m.id)}
                className="hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* ---- Scratchpad ---- */}
      <Card className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <NotebookPen className="size-4 text-accent" />
          <h2 className="text-sm font-semibold">Scratchpad</h2>
          <span className="text-[10px] text-muted-foreground">
            Persistent free-form notes available to R2D2 during tasks.
          </span>
        </div>
        <Textarea
          rows={6}
          value={scratch}
          onChange={(e) => setScratch(e.target.value)}
          placeholder="Open notes, thoughts, partially-done plans…"
          className="font-mono text-xs"
        />
        <div className="flex items-center gap-3">
          <Button onClick={saveScratch}>
            <Save className="size-4" /> Save scratchpad
          </Button>
          {scratchSavedAt && (
            <span className="text-xs text-muted-foreground">
              Saved {new Date(scratchSavedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
