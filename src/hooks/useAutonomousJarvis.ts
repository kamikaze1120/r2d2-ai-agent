import { useEffect, useRef, useState } from "react";
import { api, type AuditEntry } from "@/lib/r2d2-api";
import { useTTS } from "./useTTS";

const LS_KEY = "r2d2.jarvisAutonomous";
const LAST_AUDIT_KEY = "r2d2.jarvisLastAuditId";
const LAST_PROMPT_KEY = "r2d2.jarvisLastPromptAt";

export function getJarvisAutonomous(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_KEY) === "1";
}
export function setJarvisAutonomous(on: boolean) {
  localStorage.setItem(LS_KEY, on ? "1" : "0");
}

const PROACTIVE_PROMPTS = [
  "Sir, would you like me to scan for fresh niche opportunities?",
  "I have idle cycles. Shall I queue a strategy review?",
  "Pending approvals are stacking up — would you like a briefing?",
  "Should I generate marketing copy for the latest published product?",
  "Fancy a 30-day performance summary, sir?",
  "Care for me to research what's trending on Etsy right now?",
];

const NARRATABLE_ACTIONS: Record<string, (e: AuditEntry) => string | null> = {
  "etsy.publish": (e) =>
    e.outcome === "ok" ? "An Etsy listing has gone live, sir." : null,
  "shopify.publish": (e) =>
    e.outcome === "ok" ? "A Shopify product has been published." : null,
  "approval.held": () =>
    "A listing requires your approval before publishing, sir.",
  "task.research_niches": (e) =>
    e.outcome === "ok" ? "Fresh niche research is in." : null,
  "task.create_product": (e) =>
    e.outcome === "ok" ? "A new digital product has been generated." : null,
  "task.strategy_review": (e) =>
    e.outcome === "ok" ? "Strategy review complete, sir." : null,
  "automation.worker_start": () => "Automation engine engaged, sir.",
  "marketing.generate": (e) =>
    e.outcome === "ok" ? "Marketing assets ready for review." : null,
};

type Notice = { id: string; ts: number; text: string; kind: "milestone" | "prompt" };

export type JarvisState = {
  enabled: boolean;
  notices: Notice[];
  toggle: () => void;
  dismissNotice: (id: string) => void;
};

const PROMPT_INTERVAL_MS = 4 * 60 * 1000; // every 4 minutes
const POLL_MS = 8000;
const SCHEDULED_JOBS = ["daily_business_run", "strategy_review"];

/**
 * Autonomous JARVIS mode.
 *
 * When enabled:
 *  - polls /audit; speaks + lists significant new actions
 *  - every ~4 minutes, asks a proactive question and speaks it
 *  - kicks off scheduled engine jobs once per browser session
 */
export function useAutonomousJarvis(): JarvisState {
  const [enabled, setEnabled] = useState<boolean>(() => getJarvisAutonomous());
  const [notices, setNotices] = useState<Notice[]>([]);
  const tts = useTTS();
  const lastAuditId = useRef<number>(
    typeof window !== "undefined"
      ? Number(localStorage.getItem(LAST_AUDIT_KEY) || 0)
      : 0,
  );
  const lastPromptAt = useRef<number>(
    typeof window !== "undefined"
      ? Number(localStorage.getItem(LAST_PROMPT_KEY) || 0)
      : 0,
  );
  const triggeredJobs = useRef<Set<string>>(new Set());

  const pushNotice = (n: Omit<Notice, "id" | "ts">) => {
    const notice: Notice = {
      ...n,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
    };
    setNotices((cur) => [notice, ...cur].slice(0, 6));
  };

  const dismissNotice = (id: string) =>
    setNotices((cur) => cur.filter((n) => n.id !== id));

  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    setJarvisAutonomous(next);
    if (next) {
      tts.speak("Autonomous mode online, sir. Standing by.");
    } else {
      tts.stop();
    }
  };

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    // Trigger scheduler jobs once per browser session when first turning on.
    (async () => {
      for (const job of SCHEDULED_JOBS) {
        if (triggeredJobs.current.has(job)) continue;
        try {
          await api.automationTrigger(job);
          triggeredJobs.current.add(job);
        } catch {
          /* offline */
        }
      }
    })();

    const tick = async () => {
      // 1) Drain new audit entries
      try {
        const r = await api.audit({ limit: 50 });
        const fresh = r.entries
          .filter((e) => e.id > lastAuditId.current)
          .reverse(); // oldest-first
        if (fresh.length) {
          lastAuditId.current = Math.max(...r.entries.map((e) => e.id));
          localStorage.setItem(LAST_AUDIT_KEY, String(lastAuditId.current));
          for (const e of fresh) {
            const fn = NARRATABLE_ACTIONS[e.action];
            if (!fn) continue;
            const text = fn(e);
            if (!text) continue;
            pushNotice({ kind: "milestone", text });
          }
          // Speak only the latest milestone to avoid runaway audio
          const latest = fresh
            .map((e) => NARRATABLE_ACTIONS[e.action]?.(e))
            .filter(Boolean) as string[];
          if (latest.length) tts.speak(latest[latest.length - 1]);
        }
      } catch {
        /* offline — silently retry */
      }

      // 2) Proactive prompt every ~4 minutes
      const now = Date.now();
      if (now - lastPromptAt.current > PROMPT_INTERVAL_MS) {
        lastPromptAt.current = now;
        localStorage.setItem(LAST_PROMPT_KEY, String(now));
        const prompt =
          PROACTIVE_PROMPTS[Math.floor(Math.random() * PROACTIVE_PROMPTS.length)];
        pushNotice({ kind: "prompt", text: prompt });
        // Stagger speech so it doesn't collide with milestones
        setTimeout(() => {
          if (!cancelled) tts.speak(prompt);
        }, 1500);
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { enabled, notices, toggle, dismissNotice };
}
