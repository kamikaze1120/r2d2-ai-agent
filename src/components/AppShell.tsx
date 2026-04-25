import { Link, useLocation } from "@tanstack/react-router";
import { useR2D2Health } from "@/hooks/useR2D2Health";
import { cn } from "@/lib/utils";
import {
  Activity,
  MessageSquare,
  Wrench,
  Brain,
  Settings,
  ListChecks,
  Package,
  BarChart3,
  ShieldCheck,
  Megaphone,
  ScrollText,
  Sparkles,
} from "lucide-react";
import { AutomationToggle } from "@/components/AutomationToggle";
import { R2D2AutonomousToggle } from "@/components/R2D2AutonomousToggle";

const NAV = [
  { to: "/", label: "Cockpit", icon: Sparkles },
  { to: "/chat", label: "Chat", icon: MessageSquare },
  { to: "/tasks", label: "Tasks", icon: ListChecks },
  { to: "/products", label: "Products", icon: Package },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/marketing", label: "Marketing", icon: Megaphone },
  { to: "/audit", label: "Audit", icon: ScrollText },
  { to: "/tools", label: "Tools", icon: Wrench },
  { to: "/memory", label: "Memory", icon: Brain },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { health, connected, loading, error } = useR2D2Health(5000);

  return (
    <div className="relative flex min-h-screen flex-col text-foreground">
      {/* ---------- Ambient aurora backdrop ---------- */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-32 top-[-10%] h-[520px] w-[520px] rounded-full bg-primary/25 blur-[120px] animate-aurora" />
        <div
          className="absolute right-[-10%] top-[20%] h-[480px] w-[480px] rounded-full bg-accent/20 blur-[120px] animate-aurora"
          style={{ animationDelay: "-7s" }}
        />
        <div
          className="absolute left-[30%] bottom-[-15%] h-[420px] w-[420px] rounded-full bg-primary/15 blur-[120px] animate-aurora"
          style={{ animationDelay: "-3s" }}
        />
      </div>

      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="group flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 -z-10 rounded-xl bg-primary/40 blur-lg opacity-60 transition-opacity group-hover:opacity-100" />
              <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground font-black shadow-elevated">
                R2
              </div>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold tracking-wide text-gradient-primary">
                R2D2 CONTROL
              </span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Local-first AI agent
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-0.5 lg:flex">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "relative flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all duration-200",
                    active
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                  )}
                >
                  {active && (
                    <span className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-b from-primary/20 to-primary/5 ring-1 ring-primary/40 shadow-[0_0_18px_-4px_var(--color-primary)]" />
                  )}
                  <Icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <R2D2AutonomousToggle />
            <AutomationToggle />
            <StatusPill
              connected={connected}
              loading={loading}
              error={error}
              health={health}
            />
          </div>
        </div>

        {/* Mobile / tablet nav */}
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border/60 px-3 py-2 lg:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs transition-colors",
                  active
                    ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                    : "text-muted-foreground hover:bg-secondary/60",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 animate-fade-in">
        {children}
      </main>

      <footer className="relative z-10 border-t border-border/60 bg-background/40 px-4 py-4 text-center text-xs text-muted-foreground backdrop-blur">
        R2D2 runs on your machine. The panel only sends commands — no model data
        leaves your computer.
      </footer>
    </div>
  );
}

function StatusPill({
  connected,
  loading,
  error,
  health,
}: {
  connected: boolean;
  loading: boolean;
  error: string | null;
  health: ReturnType<typeof useR2D2Health>["health"];
}) {
  let color = "bg-muted-foreground";
  let ring = "ring-muted-foreground/30";
  let label = "Connecting…";
  let title = "";

  if (!loading) {
    if (connected && health?.ollama.ok) {
      color = "bg-success";
      ring = "ring-success/40";
      label = "Online";
      title = `Ollama OK · ${health.ollama.models.length} model(s)`;
    } else if (connected && !health?.ollama.ok) {
      color = "bg-warning";
      ring = "ring-warning/40";
      label = "Agent up · Ollama down";
      title = "Start Ollama: `ollama serve`";
    } else {
      color = "bg-destructive";
      ring = "ring-destructive/40";
      label = "Offline";
      title = error || "Cannot reach R2D2 API";
    }
  }

  return (
    <div
      title={title}
      className={cn(
        "hidden items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs ring-1 backdrop-blur sm:flex",
        ring,
      )}
    >
      <span className={cn("relative flex size-2 rounded-full", color)}>
        {connected && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-70",
              color,
            )}
          />
        )}
      </span>
      <Activity className="size-3 text-muted-foreground" />
      <span className="font-medium">{label}</span>
    </div>
  );
}
