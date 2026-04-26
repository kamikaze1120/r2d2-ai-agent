/**
 * Compact header dropdown that lists installed Ollama models and lets the
 * user switch the active one without leaving the current page.
 */
import { useEffect, useState } from "react";
import { ChevronDown, Cpu, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getModel, setModel } from "@/lib/r2d2-api";
import { fetchOllamaModels, getOllamaBase } from "@/lib/r2d2-settings";
import { toast } from "sonner";

export function ModelSwitcher() {
  const [models, setModels] = useState<string[]>([]);
  const [current, setCurrent] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setModels(await fetchOllamaModels(getOllamaBase()));
      setCurrent(getModel());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const choose = (m: string) => {
    setModel(m);
    setCurrent(m);
    toast.success("Model switched", { description: m || "(server default)" });
  };

  return (
    <DropdownMenu onOpenChange={(o) => o && load()}>
      <DropdownMenuTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-full border-border/60 bg-secondary/40 backdrop-blur hover:bg-secondary/70"
          title="Switch Ollama model"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Cpu className="size-3.5" />
          )}
          <span className="max-w-[10rem] truncate text-xs font-mono">
            {current || "default"}
          </span>
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Ollama models</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => choose("")}>
          <span className="font-mono text-xs">(server default)</span>
        </DropdownMenuItem>
        {models.length === 0 && (
          <DropdownMenuItem disabled className="text-xs text-muted-foreground">
            No models — try `ollama pull llama3.2`
          </DropdownMenuItem>
        )}
        {models.map((m) => (
          <DropdownMenuItem key={m} onClick={() => choose(m)}>
            <span className="font-mono text-xs">{m}</span>
            {current === m && <span className="ml-auto text-primary">●</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
