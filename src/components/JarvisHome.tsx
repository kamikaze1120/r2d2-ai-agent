import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { JarvisGlobe } from "@/components/JarvisGlobe";
import { useTTS, getElevenKey } from "@/hooks/useTTS";
import { useAutonomousJarvis } from "@/hooks/useAutonomousJarvis";
import { api, getModel, streamChat, type ChatEvent } from "@/lib/r2d2-api";
import { Link } from "@tanstack/react-router";
import {
  Mic,
  Send,
  Square,
  Sparkles,
  MessageSquare,
  AlertCircle,
  X,
  ListChecks,
  Package,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function JarvisHome() {
  const tts = useTTS();
  const jarvis = useAutonomousJarvis();
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [lastReply, setLastReply] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState<{
    pending: number;
    needsApproval: number;
    products: number;
  } | null>(null);
  const replyRef = useRef<HTMLDivElement>(null);

  // Pull at-a-glance stats for the cockpit
  useEffect(() => {
    const load = async () => {
      try {
        const [auto, products] = await Promise.all([
          api.automationStatus(),
          api.listProducts(),
        ]);
        setStats({
          pending: auto.worker.stats.pending,
          needsApproval: auto.worker.stats.needs_approval,
          products: products.products.length,
        });
      } catch {
        /* offline */
      }
    };
    load();
    const id = setInterval(load, 10000);
    return () => clearInterval(id);
  }, []);

  const send = async () => {
    if (!input.trim() || thinking) return;
    const message = input.trim();
    setInput("");
    setLastReply("");
    setErr(null);
    setThinking(true);
    try {
      await streamChat(
        { message, model: getModel() || undefined },
        (ev: ChatEvent) => {
          if (ev.type === "final") {
            setLastReply(ev.text);
            tts.speak(ev.text);
          } else if (ev.type === "error") {
            setErr(ev.message);
          }
        },
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setThinking(false);
    }
  };

  const ready = !!getElevenKey() || true; // we still allow chat without TTS

  return (
    <div className="space-y-6">
      {/* ---------- Cockpit ---------- */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card/80 to-background p-6 md:p-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_30%,rgba(76,198,255,0.18),transparent_60%)]" />

        <div className="grid items-center gap-8 md:grid-cols-[auto_1fr]">
          <div className="mx-auto">
            <JarvisGlobe size={300} speaking={tts.speaking} />
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary/80">
                <Sparkles className="size-3.5" />
                {jarvis.enabled ? "Autonomous mode" : "Standby"}
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
                {tts.speaking
                  ? "Speaking…"
                  : jarvis.enabled
                    ? "At your service, sir."
                    : "R2D2 standing by."}
              </h1>
              <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                Speak your orders below or jump into a full chat session. With
                autonomous mode engaged, I'll narrate milestones, ask proactive
                questions, and run scheduled business jobs on your behalf.
              </p>
            </div>

            {/* Voice / command bar */}
            <Card className="flex items-center gap-2 p-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                disabled={thinking}
                placeholder="Your orders, sir… (e.g. 'R2D2, queue a strategy review')"
                className="h-10 border-0 bg-transparent text-base focus-visible:ring-0"
              />
              {tts.speaking ? (
                <Button onClick={tts.stop} variant="outline" size="icon" title="Stop">
                  <Square className="size-4" />
                </Button>
              ) : (
                <Button
                  onClick={send}
                  disabled={!input.trim() || thinking}
                  size="icon"
                  title="Send"
                >
                  <Send className="size-4" />
                </Button>
              )}
              <Button asChild variant="ghost" size="icon" title="Open chat">
                <Link to="/chat">
                  <MessageSquare className="size-4" />
                </Link>
              </Button>
            </Card>

            {!ready && (
              <p className="text-xs text-warning">
                Add your ElevenLabs key in Settings → Voice for spoken replies.
              </p>
            )}

            {err && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span className="break-all">{err}</span>
              </div>
            )}

            {/* Live reply transcript */}
            {(thinking || lastReply) && (
              <Card
                ref={replyRef}
                className={cn(
                  "max-h-48 overflow-auto p-3 text-sm leading-relaxed",
                  thinking && !lastReply && "italic text-muted-foreground",
                )}
              >
                {thinking && !lastReply
                  ? "Processing your request, sir…"
                  : lastReply}
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Notice strip ---------- */}
      {jarvis.notices.length > 0 && (
        <div className="space-y-2">
          {jarvis.notices.map((n) => (
            <div
              key={n.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-sm",
                n.kind === "prompt"
                  ? "border-accent/40 bg-accent/10"
                  : "border-primary/30 bg-primary/10",
              )}
            >
              <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
              <div className="flex-1">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {n.kind === "prompt" ? "JARVIS asks" : "Milestone"}
                </div>
                <div>{n.text}</div>
              </div>
              <button
                onClick={() => jarvis.dismissNotice(n.id)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---------- At-a-glance ---------- */}
      <div className="grid gap-3 md:grid-cols-3">
        <StatCard
          icon={ListChecks}
          label="Tasks pending"
          value={stats?.pending ?? "—"}
          to="/tasks"
        />
        <StatCard
          icon={ShieldCheck}
          label="Awaiting approval"
          value={stats?.needsApproval ?? "—"}
          to="/approvals"
          accent={!!stats?.needsApproval}
        />
        <StatCard
          icon={Package}
          label="Products generated"
          value={stats?.products ?? "—"}
          to="/products"
        />
      </div>

      {/* ---------- Footer hint ---------- */}
      <Card className="flex items-center gap-3 p-4 text-xs text-muted-foreground">
        <Mic className="size-4" />
        Tip: turn on{" "}
        <Badge variant="outline" className="font-normal">
          JARVIS
        </Badge>{" "}
        in the header to let R2D2 narrate the engine, ask you questions, and
        kick off scheduled jobs without prompting.
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  to,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  to: string;
  accent?: boolean;
}) {
  return (
    <Link to={to}>
      <Card
        className={cn(
          "flex items-center justify-between p-4 transition hover:border-primary/60",
          accent && "border-accent/40 bg-accent/10",
        )}
      >
        <div>
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="text-2xl font-semibold">{value}</div>
        </div>
        <Icon className="size-6 text-primary/70" />
      </Card>
    </Link>
  );
}
