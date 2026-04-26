import { Link, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { AutomationToggle } from "@/components/AutomationToggle";
import { R2D2AutonomousToggle } from "@/components/R2D2AutonomousToggle";
import { FloatingVoiceBubble } from "@/components/FloatingVoiceBubble";
import { R2D2StatusAvatar, type R2D2Status } from "@/components/R2D2StatusAvatar";
import { ModelSwitcher } from "@/components/ModelSwitcher";
import { LiteModeChip } from "@/components/LiteModeChip";
import { SystemStatusWidget } from "@/components/SystemStatusWidget";
import { useTTS } from "@/hooks/useTTS";
import { useAutonomousR2D2 } from "@/hooks/useAutonomousR2D2";
import r2d2Logo from "@/assets/r2d2-logo.png";

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

const SIDEBAR_KEY = "r2d2.sidebarOpen";

function readSidebarOpen(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(SIDEBAR_KEY);
  return v === null ? true : v === "1";
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { health, connected, loading, error } = useR2D2Health(5000);
  const [open, setOpen] = useState<boolean>(readSidebarOpen);
  const tts = useTTS();
  const autonomous = useAutonomousR2D2();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
  }, [open]);

  // Derive a coarse R2D2 status for the avatar
  const status: R2D2Status = !mounted
    ? "idle"
    : tts.speaking
      ? "executing"
      : autonomous.enabled
        ? "listening"
        : "idle";

  return (
    <div className="relative flex min-h-screen text-foreground">
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

      {/* ---------- Sidebar ---------- */}
      <aside
        className={cn(
          "sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-border/60 bg-sidebar/80 backdrop-blur-xl transition-[width] duration-300 ease-out lg:flex",
          open ? "w-60" : "w-[72px]",
        )}
      >
        {/* Logo / brand */}
        <div className="flex items-center gap-3 px-4 py-4">
          <Link to="/" className="group relative flex shrink-0 items-center">
            <div className="absolute inset-0 -z-10 rounded-xl bg-primary/30 blur-lg opacity-50 transition-opacity group-hover:opacity-100" />
            <img
              src={r2d2Logo}
              alt="R2D2"
              width={40}
              height={40}
              className="size-10 rounded-xl object-contain shadow-elevated"
            />
          </Link>
          {open && (
            <div className="flex flex-1 flex-col leading-tight overflow-hidden">
              <span className="truncate text-sm font-bold tracking-wide text-gradient-primary">
                R2D2 CONTROL
              </span>
              <span className="truncate text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Local-first AI
              </span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-2">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                title={!open ? item.label : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                  open ? "justify-start" : "justify-center",
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
                )}
              >
                {active && (
                  <span className="absolute inset-0 -z-10 rounded-lg bg-gradient-to-r from-primary/25 to-primary/5 ring-1 ring-primary/40 shadow-[0_0_18px_-4px_var(--color-primary)]" />
                )}
                {active && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-primary to-accent" />
                )}
                <Icon className="size-4 shrink-0" />
                {open && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Status & collapse */}
        <div className="border-t border-border/60 px-3 py-3 space-y-2">
          {open && mounted && <SystemStatusWidget />}
          {open && <StatusPill connected={connected} loading={loading} error={error} health={health} />}
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground",
              open ? "justify-start" : "justify-center",
            )}
            title={open ? "Collapse sidebar" : "Expand sidebar"}
          >
            {open ? (
              <>
                <PanelLeftClose className="size-4" />
                <span>Collapse</span>
              </>
            ) : (
              <PanelLeftOpen className="size-4" />
            )}
          </button>
        </div>
      </aside>

      {/* ---------- Main column ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-6">
            {/* Mobile logo */}
            <Link to="/" className="flex items-center gap-2 lg:hidden">
              <img
                src={r2d2Logo}
                alt="R2D2"
                width={32}
                height={32}
                className="size-8 rounded-lg object-contain"
              />
              <span className="text-sm font-bold tracking-wide text-gradient-primary">
                R2D2
              </span>
            </Link>

            <div className="hidden flex-1 lg:block" />

            <div className="flex items-center gap-2">
              {mounted && <R2D2StatusAvatar status={status} size={32} />}
              <LiteModeChip />
              <div className="hidden md:block">
                <ModelSwitcher />
              </div>
              <R2D2AutonomousToggle />
              <AutomationToggle />
              <div className="lg:hidden">
                <StatusPill connected={connected} loading={loading} error={error} health={health} />
              </div>
            </div>
          </div>

          {/* Mobile horizontal nav */}
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

        <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-4 py-8 lg:px-8 animate-fade-in">
          {children}
        </main>

        <footer className="relative z-10 border-t border-border/60 bg-background/40 px-4 py-4 text-center text-xs text-muted-foreground backdrop-blur">
          R2D2 runs on your machine. The panel only sends commands — no model
          data leaves your computer.
        </footer>
      </div>

      {/* Floating mic + voice transcript bubble (mounted globally) */}
      {mounted && <FloatingVoiceBubble />}
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
        "flex items-center gap-2 rounded-full border border-border/60 bg-secondary/40 px-3 py-1.5 text-xs ring-1 backdrop-blur",
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
