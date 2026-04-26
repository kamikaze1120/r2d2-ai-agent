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
import {
  CheckCircle2,
  XCircle,
  Save,
  RefreshCw,
  Volume2,
  Loader2,
  ExternalLink,
  KeyRound,
  Eye,
  EyeOff,
  Cpu,
  Zap,
} from "lucide-react";
import { SafetyAndSchedulerCard } from "@/components/SafetyAndSchedulerCard";
import {
  fetchOllamaModels,
  getLiteMode,
  getOllamaBase,
  getWakeWordEnabled,
  maskSecret,
  setLiteMode,
  setOllamaBase,
  setWakeWordEnabled,
} from "@/lib/r2d2-settings";
import { toast } from "sonner";

function WakeWordToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => setOn(getWakeWordEnabled()), []);
  return (
    <div className="flex items-center justify-between rounded-md border border-border p-3">
      <div>
        <Label htmlFor="wake" className="cursor-pointer">
          Wake word — “Hey R2D2”
        </Label>
        <p className="text-xs text-muted-foreground">
          When ON, R2D2 only responds to voice commands prefixed with the wake
          phrase. Use the floating mic in the bottom-right to start listening.
        </p>
      </div>
      <Switch
        id="wake"
        checked={on}
        onCheckedChange={(v) => {
          setOn(v);
          setWakeWordEnabled(v);
        }}
      />
    </div>
  );
}

export function SettingsView() {
  const [base, setBase] = useState(getApiBase());
  const [model, setModelState] = useState(getModel());
  const [voice, setVoice] = useState(getVoiceId());
  const [auto, setAuto] = useState(getAutoSpeak());
  const [elevenKey, setElevenKeyState] = useState(getElevenKey());
  const [showKey, setShowKey] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [ollamaBase, setOllamaBaseState] = useState(getOllamaBase());
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [lite, setLite] = useState(getLiteMode());
  const { health, connected, loading, error } = useR2D2Health(7000);
  const { speak, speaking, error: ttsError } = useTTS();

  useEffect(() => {
    if (!model && health?.default_model) setModelState(health.default_model);
  }, [health, model]);

  useEffect(() => {
    fetchOllamaModels(ollamaBase).then(setLocalModels);
  }, [ollamaBase]);

  const save = () => {
    setApiBase(base);
    setModel(model);
    setVoiceId(voice);
    setAutoSpeak(auto);
    setElevenKey(elevenKey);
    setOllamaBase(ollamaBase);
    setLiteMode(lite);
    setSavedAt(Date.now());
    toast.success("Settings saved", {
      description: "Reconnecting to apply changes…",
    });
    setTimeout(() => window.location.reload(), 600);
  };

  const saveKeysOnly = () => {
    setElevenKey(elevenKey);
    setVoiceId(voice);
    setOllamaBase(ollamaBase);
    setModel(model);
    toast.success("Keys & integrations saved", {
      description: elevenKey
        ? `ElevenLabs key ending in ${elevenKey.slice(-4)} stored locally.`
        : "Stored locally in this browser.",
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Point the panel at your local R2D2 agent and pick a model.
        </p>
      </div>

      {/* ============== API Keys & Integrations ============== */}
      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" />
          <h2 className="text-base font-semibold">API Keys & Integrations</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Edit credentials directly here — no shell scripts needed. Everything is
          stored in your browser only.
        </p>

        <div className="space-y-2">
          <Label htmlFor="elevenkey" className="flex items-center gap-1.5">
            ElevenLabs API key
            {elevenKey && (
              <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                saved · {maskSecret(elevenKey)}
              </span>
            )}
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="elevenkey"
              type={showKey ? "text" : "password"}
              value={elevenKey}
              onChange={(e) => setElevenKeyState(e.target.value)}
              placeholder="sk_..."
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowKey((s) => !s)}
              title={showKey ? "Hide" : "Show"}
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            No key?{" "}
            <a
              href="https://elevenlabs.io/app/settings/api-keys"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              Create one in ElevenLabs <ExternalLink className="size-3" />
            </a>
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice">Voice ID</Label>
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
          <Input
            value={voice}
            onChange={(e) => setVoice(e.target.value)}
            placeholder="Or paste a custom ElevenLabs voice ID"
            className="text-xs font-mono"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ollama-base">Ollama base URL</Label>
            <Input
              id="ollama-base"
              value={ollamaBase}
              onChange={(e) => setOllamaBaseState(e.target.value)}
              placeholder="http://127.0.0.1:11434"
            />
            <p className="text-xs text-muted-foreground">
              {localModels.length
                ? `${localModels.length} model(s) detected`
                : "No models detected — start Ollama or pull one"}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="model-name">Model name</Label>
            {localModels.length > 0 ? (
              <select
                id="model-name"
                value={model}
                onChange={(e) => setModelState(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-input px-3 py-1 text-sm"
              >
                <option value="">Server default ({health?.default_model || "auto"})</option>
                {localModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                id="model-name"
                value={model}
                onChange={(e) => setModelState(e.target.value)}
                placeholder="llama3.2"
              />
            )}
          </div>
        </div>

        <div>
          <Button onClick={saveKeysOnly} variant="default" className="gap-1.5">
            <Save className="size-4" /> Save keys & integrations
          </Button>
        </div>
      </Card>

      {/* ============== Performance & Voice commands ============== */}
      <Card className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-accent" />
          <h2 className="text-base font-semibold">Performance & voice commands</h2>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <Label htmlFor="lite" className="cursor-pointer flex items-center gap-2">
              <Cpu className="size-4" /> Lightweight Mode
            </Label>
            <p className="text-xs text-muted-foreground">
              Trims context to ~512 tokens, mutes voice narration, and stops
              proactive prompts. Best on low-RAM laptops.
            </p>
          </div>
          <Switch id="lite" checked={lite} onCheckedChange={setLite} />
        </div>
        <WakeWordToggle />
      </Card>

      {/* ============== R2D2 agent connection ============== */}
      <Card className="space-y-4 p-4">
        <h2 className="text-base font-semibold">R2D2 agent connection</h2>
        <div className="space-y-2">
          <Label htmlFor="api">R2D2 API base URL</Label>
          <Input
            id="api"
            value={base}
            onChange={(e) => setBase(e.target.value)}
            placeholder="http://localhost:8000"
          />
          <p className="text-xs text-muted-foreground">
            Use <code>http://localhost:8000</code> when this panel runs on the
            same machine. For remote use, run a tunnel and paste the public URL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={save}>
            <Save className="size-4" /> Save & reconnect
          </Button>
          <Button variant="ghost" size="sm" onClick={() => api.health().catch(() => {})}>
            <RefreshCw className="size-3" /> Refresh
          </Button>
          {savedAt && (
            <span className="text-xs text-muted-foreground">Reloading…</span>
          )}
        </div>
      </Card>

      {/* ============== Voice playback ============== */}
      <Card className="space-y-4 p-4">
        <h3 className="text-sm font-semibold">Voice playback</h3>

        <div className="flex items-center justify-between rounded-md border border-border p-3">
          <div>
            <Label htmlFor="auto" className="cursor-pointer">
              Auto-speak every reply
            </Label>
            <p className="text-xs text-muted-foreground">
              Plays R2D2's final answer as soon as it arrives (disabled in Lite Mode).
            </p>
          </div>
          <Switch id="auto" checked={auto} onCheckedChange={setAuto} />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              speak(
                "At your service, sir. Voice systems online and standing by.",
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
              detail={health?.ollama.host || ollamaBase}
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
          <li>(Optional) <code>cloudflared tunnel --url http://localhost:8000</code></li>
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
