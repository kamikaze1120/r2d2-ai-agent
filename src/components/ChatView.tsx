import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  api,
  getModel,
  streamChat,
  type ChatEvent,
  type SessionSummary,
  type Session,
} from "@/lib/r2d2-api";
import { cn } from "@/lib/utils";
import { Plus, Send, Trash2, AlertCircle, Loader2, ChevronRight } from "lucide-react";

type DisplayMsg = {
  role: "user" | "assistant";
  content: string;
  steps?: { thought: string; tool: string; args: unknown; result?: string }[];
};

export function ChatView() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DisplayMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refreshSessions = async () => {
    try {
      const r = await api.listSessions();
      setSessions(r.sessions);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    refreshSessions();
  }, []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    api.getSession(activeId).then((s: Session) => {
      setMessages(
        s.messages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      );
    });
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  const newSession = async () => {
    const s = await api.createSession();
    await refreshSessions();
    setActiveId(s.id);
  };

  const removeSession = async (id: string) => {
    await api.deleteSession(id);
    if (activeId === id) setActiveId(null);
    refreshSessions();
  };

  const send = async () => {
    if (!input.trim() || busy) return;
    setErr(null);
    const userMsg = input.trim();
    setInput("");
    const newMsgs: DisplayMsg[] = [
      ...messages,
      { role: "user", content: userMsg },
      { role: "assistant", content: "", steps: [] },
    ];
    setMessages(newMsgs);
    setBusy(true);

    let assistantIdx = newMsgs.length - 1;
    let assignedSession = activeId;

    try {
      await streamChat(
        {
          session_id: activeId ?? undefined,
          message: userMsg,
          model: getModel() || undefined,
        },
        (ev: ChatEvent) => {
          if (ev.type === "session") {
            assignedSession = ev.session_id;
            if (!activeId) setActiveId(ev.session_id);
          } else if (ev.type === "thought") {
            setMessages((cur) => {
              const copy = [...cur];
              const m = { ...copy[assistantIdx] };
              m.steps = [...(m.steps || []), { thought: ev.text, tool: "", args: {} }];
              copy[assistantIdx] = m;
              return copy;
            });
          } else if (ev.type === "tool_call") {
            setMessages((cur) => {
              const copy = [...cur];
              const m = { ...copy[assistantIdx] };
              const steps = [...(m.steps || [])];
              const last = steps[steps.length - 1];
              if (last && !last.tool) {
                steps[steps.length - 1] = { ...last, tool: ev.tool, args: ev.args };
              } else {
                steps.push({ thought: "", tool: ev.tool, args: ev.args });
              }
              m.steps = steps;
              copy[assistantIdx] = m;
              return copy;
            });
          } else if (ev.type === "tool_result") {
            setMessages((cur) => {
              const copy = [...cur];
              const m = { ...copy[assistantIdx] };
              const steps = [...(m.steps || [])];
              const last = steps[steps.length - 1];
              if (last) steps[steps.length - 1] = { ...last, result: ev.result };
              m.steps = steps;
              copy[assistantIdx] = m;
              return copy;
            });
          } else if (ev.type === "final") {
            setMessages((cur) => {
              const copy = [...cur];
              copy[assistantIdx] = { ...copy[assistantIdx], content: ev.text };
              return copy;
            });
          } else if (ev.type === "error") {
            setErr(ev.message);
          }
        },
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (assignedSession) refreshSessions();
    }
  };

  return (
    <div className="grid h-[calc(100vh-220px)] min-h-[480px] grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
      {/* Sessions sidebar */}
      <Card className="flex flex-col gap-2 p-3">
        <Button onClick={newSession} className="w-full" size="sm">
          <Plus className="size-4" />
          New chat
        </Button>
        <ScrollArea className="-mx-1 flex-1">
          <div className="flex flex-col gap-1 px-1">
            {sessions.length === 0 && (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                No sessions yet
              </div>
            )}
            {sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm",
                  activeId === s.id
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-secondary",
                )}
              >
                <button
                  onClick={() => setActiveId(s.id)}
                  className="flex-1 truncate text-left"
                  title={s.title}
                >
                  {s.title}
                </button>
                <button
                  onClick={() => removeSession(s.id)}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                  title="Delete"
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </Card>

      {/* Chat panel */}
      <Card className="flex min-h-0 flex-col">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
          {messages.length === 0 && (
            <EmptyState />
          )}
          <div className="flex flex-col gap-4">
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} />
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Thinking…
              </div>
            )}
          </div>
        </div>

        {err && (
          <div className="mx-4 mb-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            <span className="break-all">{err}</span>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-border p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Your orders, Sir… (e.g. 'R2D2, list the workspace')"
            disabled={busy}
          />
          <Button onClick={send} disabled={busy || !input.trim()}>
            <Send className="size-4" />
            Send
          </Button>
        </div>
      </Card>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary text-2xl font-bold">
        R2
      </div>
      <h2 className="text-lg font-semibold">At your service, Sir.</h2>
      <p className="max-w-sm text-sm text-muted-foreground">
        R2D2 online. Local tools armed — files, shell, web, and memory.
        Whenever you're ready, do give the word.
      </p>
      <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
        {[
          "Brief me on today's headlines, R2D2",
          "Draft a file notes.md with five ideas",
          "What's currently in the workspace?",
        ].map((s) => (
          <Badge key={s} variant="secondary" className="font-normal">
            {s}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ msg }: { msg: DisplayMsg }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm text-primary-foreground">
          {msg.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="flex max-w-[90%] flex-col gap-2">
        {msg.steps && msg.steps.length > 0 && <StepsTrail steps={msg.steps} />}
        {msg.content && (
          <div className="rounded-2xl rounded-bl-sm bg-secondary px-4 py-2 text-sm whitespace-pre-wrap">
            {msg.content}
          </div>
        )}
      </div>
    </div>
  );
}

function StepsTrail({ steps }: { steps: NonNullable<DisplayMsg["steps"]> }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-border bg-card/50 text-xs">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
        <span>{steps.length} step{steps.length === 1 ? "" : "s"} · agent reasoning</span>
      </button>
      {open && (
        <div className="flex flex-col gap-2 border-t border-border p-3">
          {steps.map((s, i) => (
            <div key={i} className="flex flex-col gap-1">
              {s.thought && (
                <div className="text-muted-foreground italic">💭 {s.thought}</div>
              )}
              {s.tool && (
                <div>
                  <Badge variant="outline" className="mr-1 font-mono">
                    {s.tool}
                  </Badge>
                  <code className="text-[10px] text-muted-foreground">
                    {JSON.stringify(s.args)}
                  </code>
                </div>
              )}
              {s.result && (
                <pre className="max-h-32 overflow-auto rounded bg-muted/60 p-2 font-mono text-[10px] text-muted-foreground">
                  {s.result}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
