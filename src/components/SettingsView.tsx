import { useEffect, useState } from "react";
import { api, getApiBase, getModel, setApiBase, setModel } from "@/lib/r2d2-api";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useR2D2Health } from "@/hooks/useR2D2Health";
import {
  VOICE_OPTIONS,
  getAutoSpeak,
  getElevenKey,
  getVoiceId,
  setAutoSpeak,
  setElevenKey,
  setVoiceId,
  useTTS,
} from "@/hooks/useTTS";
import { CheckCircle2, XCircle, Save, RefreshCw, Volume2, Loader2, ExternalLink, KeyRound, Eye, EyeOff } from "lucide-react";
import { SafetyAndSchedulerCard } from "@/components/SafetyAndSchedulerCard";

export function SettingsView() {
  const [base, setBase] = useState(getApiBase());
  const [model, setModelState] = useState(getModel());
  const [voice, setVoice] = useState(getVoiceId());
  const [auto, setAuto] = useState(getAutoSpeak());
  const [elevenKey, setElevenKeyState] = useState(getElevenKey());
  const [showKey, setShowKey] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const { health, connected, loading, error } = useR2D2Health(7000);
  const { speak, speaking, error: ttsError } = useTTS();

  useEffect(() => {
    if (!model && health?.default_model) setModelState(health.default_model);
  }, [health, model]);

  const save = () => {
    setApiBase(base);
    setModel(model);
    setVoiceId(voice);
    setAutoSpeak(auto);
    setElevenKey(elevenKey);
    setSavedAt(Date.now());
    // Refresh page-level state by reloading; cheap and reliable
    setTimeout(() => window.location.reload(), 400);
  };

  const refreshModels = async () => {
    try {
      await api.health();
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Point the panel at your local R2D2 agent and pick a model.
        </p>
      </div>

      <Card className="space-y-4 p-4">
        <div className="space-y-2">
          <Label htmlFor="api">R2D2 API base URL</Label>
          <Input
            id="api"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="http://localhost:8000 or https://abc.trycloudflare.com"
          />
          <p className="text-xs text-muted-foreground">
            Use <code>http://localhost:8000</code> when this panel runs on the
            same machine. For remote use, run a tunnel (Cloudflare or ngrok)
            and paste the public URL here.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="model">Default model</Label>
            <Button variant="ghost" size="sm" onClick={refreshModels}>
              <RefreshCw className="size-3" /> Refresh
            </Button>
          </div>
          {health?.ollama.models && health.ollama.models.length > 0 ? (
            <select
              id="model"
              value={model}
              onChange={(e) => setModelState(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm"
            >
              <option value="">Use server default ({health.default_model})</option>
              {health.ollama.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="model"
              value={model}
              onChange={(e) => setModelState(e.target.value)}
              placeholder="llama3.2"
            />
          )}
          <p className="text-xs text-muted-foreground">
            Models are pulled on your laptop with{" "}
            <code>ollama pull llama3.2</code>.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save}>
            <Save className="size-4" /> Save & reconnect
          </Button>
          {savedAt && (
            <span className="text-xs text-muted-foreground">Reloading…</span>
          )}
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <div>
          <h3 className="text-sm font-semibold">Voice</h3>
          <p className="text-xs text-muted-foreground">
            R2D2 speaks aloud using ElevenLabs. The key stays on the server.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice">Voice</Label>
          <select
            id="voice"
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm"
          >
            {VOICE_OPTIONS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <Label htmlFor="auto" className="cursor-pointer">
              Auto-speak every reply
            </Label>
            <p className="text-xs text-muted-foreground">
              Plays R2D2's final answer as soon as it arrives.
            </p>
          </div>
          <Switch id="auto" checked={auto} onCheckedChange={setAuto} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              speak(
                "At your service, Sir. Voice systems online and standing by.",
                voice,
              )
            }
            disabled={speaking}
          >
            {speaking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Volume2 className="size-4" />
            )}
            Test voice
          </Button>
          {ttsError && (
            <span className="text-xs text-destructive">{ttsError}</span>
          )}
        </div>
      </Card>

      <Card className="space-y-3 p-4">
        <h3 className="text-sm font-semibold">Connection status</h3>
        {loading && <p className="text-xs text-muted-foreground">Checking…</p>}
        {!loading && (
          <ul className="space-y-2 text-sm">
            <Status ok={connected} label="R2D2 API reachable" detail={connected ? base : error || "not reachable"} />
            <Status
              ok={!!health?.ollama.ok}
              label="Ollama daemon"
              detail={health?.ollama.host || "unknown"}
            />
            <Status
              ok={!!health?.ollama.models?.length}
              label="At least one model installed"
              detail={
                health?.ollama.models?.length
                  ? `${health.ollama.models.length} available`
                  : "Run: ollama pull llama3.2"
              }
            />
          </ul>
        )}
      </Card>

      <SafetyAndSchedulerCard />

      <Card className="space-y-2 p-4">
        <h3 className="text-sm font-semibold">Quick start</h3>
        <ol className="ml-4 list-decimal space-y-1 text-xs text-muted-foreground">
          <li>Install Ollama: <code>curl -fsSL https://ollama.com/install.sh | sh</code></li>
          <li>Pull a model: <code>ollama pull llama3.2</code></li>
          <li>Start the agent: <code>cd r2d2-agent && ./run.sh</code></li>
          <li>(Optional, for remote access) <code>cloudflared tunnel --url http://localhost:8000</code></li>
        </ol>
      </Card>
    </div>
  );
}

function Status({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? (
        <CheckCircle2 className="mt-0.5 size-4 text-success" />
      ) : (
        <XCircle className="mt-0.5 size-4 text-destructive" />
      )}
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-xs text-muted-foreground break-all">{detail}</div>
      </div>
    </li>
  );
}
