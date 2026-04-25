import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { R2D2Globe } from "@/components/R2D2Globe";
import { useTTS, getElevenKey } from "@/hooks/useTTS";
import { useAutonomousR2D2 } from "@/hooks/useAutonomousR2D2";
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

export function R2D2Home() {
  const tts = useTTS();
  const autonomous = useAutonomousR2D2();
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
    <div className="space-y-8">
      {/* ---------- Cinematic Cockpit ---------- */}
      <section className="relative overflow-hidden rounded-3xl border border-border/60 shadow-elevated">
        {/* layered backdrops */}
        <div
          aria-hidden
          className="absolute inset-0 -z-20"
          style={{ background: "var(--gradient-cockpit)" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-b from-card/40 via-background/20 to-background/80"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />

        <div className="relative grid items-center gap-8 p-6 md:grid-cols-[auto_1fr] md:gap-12 md:p-12">
          {/* Globe + orbiting rings */}
          <div className="relative mx-auto flex size-[320px] items-center justify-center">
            <div
              aria-hidden
              className="absolute inset-0 rounded-full border border-primary/20 animate-orbit-slow"
            >
              <div className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
            </div>
            <div
              aria-hidden
              className="absolute inset-6 rounded-full border border-accent/20 animate-orbit-reverse"
            >
              <div className="absolute right-0 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_10px_var(--color-accent)]" />
            </div>
            <div className="animate-float-slow">
              <R2D2Globe size={300} speaking={tts.speaking} />
            </div>
          </div>

          {/* Command panel */}
          <div className="flex flex-col gap-5">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.35em] text-primary/90">
                <span className="relative flex size-2">
                  <span
                    className={cn(
                      "absolute inline-flex size-full rounded-full opacity-70",
                      autonomous.enabled
                        ? "animate-ping bg-accent"
                        : "bg-primary",
                    )}
                  />
                  <span
                    className={cn(
                      "relative inline-flex size-2 rounded-full",
                      autonomous.enabled ? "bg-accent" : "bg-primary",
                    )}
                  />
                </span>
                {autonomous.enabled ? "Autonomous Mode Engaged" : "Standby"}
              </div>
              <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
                {tts.speaking ? (
                  <span className="text-gradient-accent">Speaking…</span>
                ) : autonomous.enabled ? (
                  <span className="text-gradient-primary">
                    At your service, sir.
                  </span>
                ) : (
                  <span className="text-gradient-primary">
                    R2D2 standing by.
                  </span>
                )}
              </h1>
              <p className="mt-3 max-w-prose text-sm leading-relaxed text-muted-foreground">
                Speak your orders below or jump into a full chat session. With
                autonomous mode engaged, I'll narrate milestones, ask proactive
                questions, and run scheduled business jobs on your behalf.
              </p>
            </div>

            {/* Voice / command bar */}
            <div className="group relative">
              <div
                aria-hidden
                className="absolute -inset-px rounded-xl bg-gradient-to-r from-primary/40 via-accent/30 to-primary/40 opacity-60 blur-sm transition-opacity group-focus-within:opacity-100"
              />
              <Card className="relative flex items-center gap-2 rounded-xl border-border/60 bg-card/80 p-2 backdrop-blur">
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
                  className="h-11 border-0 bg-transparent text-base shadow-none focus-visible:ring-0"
                />
                {tts.speaking ? (
                  <Button
                    onClick={tts.stop}
                    variant="outline"
                    size="icon"
                    title="Stop"
                    className="rounded-lg"
                  >
                    <Square className="size-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={send}
                    disabled={!input.trim() || thinking}
                    size="icon"
                    title="Send"
                    className="rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_4px_20px_-6px_var(--color-primary)] hover:opacity-95"
                  >
                    <Send className="size-4" />
                  </Button>
                )}
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  title="Open chat"
                  className="rounded-lg"
                >
                  <Link to="/chat">
                    <MessageSquare className="size-4" />
                  </Link>
                </Button>
              </Card>
            </div>

            {!ready && (
              <p className="text-xs text-warning">
                Add your ElevenLabs key in Settings → Voice for spoken replies.
              </p>
            )}

            {err && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive animate-fade-in">
                <AlertCircle className="size-4 shrink-0" />
                <span className="break-all">{err}</span>
              </div>
            )}

            {/* Live reply transcript */}
            {(thinking || lastReply) && (
              <Card
                ref={replyRef}
                className={cn(
                  "max-h-48 overflow-auto rounded-xl border-primary/20 bg-card/70 p-4 text-sm leading-relaxed backdrop-blur animate-fade-in",
                  thinking && !lastReply && "italic text-muted-foreground",
                )}
              >
                {thinking && !lastReply ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="flex gap-1">
                      <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
                      <span className="size-1.5 animate-bounce rounded-full bg-primary" />
                    </span>
                    Processing your request, sir…
                  </span>
                ) : (
                  lastReply
                )}
              </Card>
            )}
          </div>
        </div>
      </section>

      {/* ---------- Notice strip ---------- */}
      {autonomous.notices.length > 0 && (
        <div className="space-y-2">
          {autonomous.notices.map((n) => (
            <div
              key={n.id}
              className={cn(
                "group flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-sm backdrop-blur transition-all hover:translate-x-0.5 animate-fade-in",
                n.kind === "prompt"
                  ? "border-accent/40 bg-accent/10 hover:border-accent/60 hover:shadow-[0_0_24px_-8px_var(--color-accent)]"
                  : "border-primary/30 bg-primary/10 hover:border-primary/60 hover:shadow-[0_0_24px_-8px_var(--color-primary)]",
              )}
            >
              <Sparkles
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  n.kind === "prompt" ? "text-accent" : "text-primary",
                )}
              />
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  {n.kind === "prompt" ? "R2D2 asks" : "Milestone"}
                </div>
                <div className="mt-0.5">{n.text}</div>
              </div>
              <button
                onClick={() => autonomous.dismissNotice(n.id)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Dismiss"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---------- At-a-glance ---------- */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          icon={ListChecks}
          label="Tasks pending"
          value={stats?.pending ?? "—"}
          to="/tasks"
          tone="primary"
        />
        <StatCard
          icon={ShieldCheck}
          label="Awaiting approval"
          value={stats?.needsApproval ?? "—"}
          to="/approvals"
          tone="accent"
          accent={!!stats?.needsApproval}
        />
        <StatCard
          icon={Package}
          label="Products generated"
          value={stats?.products ?? "—"}
          to="/products"
          tone="success"
        />
      </div>

      {/* ---------- Footer hint ---------- */}
      <Card className="flex flex-wrap items-center gap-3 rounded-xl border-border/60 bg-card/60 p-4 text-xs text-muted-foreground backdrop-blur">
        <Mic className="size-4 text-primary" />
        Tip: turn on{" "}
        <Badge
          variant="outline"
          className="border-accent/40 bg-accent/10 font-normal text-accent"
        >
          R2D2
        </Badge>{" "}
        in the header to let R2D2 narrate the engine, ask you questions, and
        kick off scheduled jobs without prompting.
      </Card>
    </div>
  );
}

const TONE_STYLES = {
  primary: {
    icon: "text-primary",
    glow: "from-primary/30",
    ring: "hover:border-primary/60 hover:shadow-[0_0_30px_-8px_var(--color-primary)]",
  },
  accent: {
    icon: "text-accent",
    glow: "from-accent/30",
    ring: "hover:border-accent/60 hover:shadow-[0_0_30px_-8px_var(--color-accent)]",
  },
  success: {
    icon: "text-success",
    glow: "from-success/30",
    ring: "hover:border-success/60 hover:shadow-[0_0_30px_-8px_var(--color-success)]",
  },
} as const;

function StatCard({
  icon: Icon,
  label,
  value,
  to,
  tone = "primary",
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  to: string;
  tone?: keyof typeof TONE_STYLES;
  accent?: boolean;
}) {
  const t = TONE_STYLES[tone];
  return (
    <Link to={to} className="group block">
      <Card
        className={cn(
          "relative overflow-hidden rounded-xl border-border/60 bg-card/70 p-5 backdrop-blur transition-all duration-300 hover:-translate-y-0.5",
          t.ring,
          accent && "border-accent/50 bg-accent/10 animate-pulse-glow",
        )}
      >
        {/* corner glow */}
        <div
          aria-hidden
          className={cn(
            "absolute -right-10 -top-10 size-32 rounded-full bg-gradient-radial blur-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-60",
            t.glow,
            "to-transparent",
          )}
        />
        <div className="relative flex items-center justify-between">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              {label}
            </div>
            <div className="mt-2 text-3xl font-bold tracking-tight">
              {value}
            </div>
          </div>
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-xl bg-secondary/60 ring-1 ring-border/60 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
              t.icon,
            )}
          >
            <Icon className="size-6" />
          </div>
        </div>
      </Card>
    </Link>
  );
}

