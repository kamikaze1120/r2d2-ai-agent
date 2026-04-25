import { Link, useLocation } from "@tanstack/react-router";
import { useR2D2Health } from "@/hooks/useR2D2Health";
import { cn } from "@/lib/utils";
import { Activity, MessageSquare, Wrench, Brain, Settings, ListChecks, Package, BarChart3, ShieldCheck, Megaphone, ScrollText, Sparkles } from "lucide-react";
import { AutomationToggle } from "@/components/AutomationToggle";
import { JarvisAutonomousToggle } from "@/components/JarvisAutonomousToggle";

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
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
              R2
            </div>
            <div>
              <div className="text-sm font-semibold leading-tight">R2D2 Control</div>
              <div className="text-xs text-muted-foreground leading-tight">
                Local-first AI agent
              </div>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <JarvisAutonomousToggle />
            <AutomationToggle />
            <StatusPill connected={connected} loading={loading} error={error} health={health} />
          </div>
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto border-t border-border px-3 py-2 md:hidden">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs",
                  active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground",
                )}
              >
                <Icon className="size-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
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
  let label = "Connecting…";
  let title = "";

  if (!loading) {
    if (connected && health?.ollama.ok) {
      color = "bg-success";
      label = "Online";
      title = `Ollama OK · ${health.ollama.models.length} model(s)`;
    } else if (connected && !health?.ollama.ok) {
      color = "bg-warning";
      label = "Agent up · Ollama down";
      title = "Start Ollama: `ollama serve`";
    } else {
      color = "bg-destructive";
      label = "Offline";
      title = error || "Cannot reach R2D2 API";
    }
  }

  return (
    <div
      title={title}
      className="flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs"
    >
      <span className={cn("relative flex size-2 rounded-full", color)}>
        {connected && (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
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
