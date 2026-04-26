/**
 * Voice command parser & dispatcher.
 *
 * Converts a free-form spoken phrase into a concrete action: open URL, run
 * search, speak text, add memory, add task, stop, narrate state.
 */
import { addMemory } from "@/lib/r2d2-memory";
import { createTask, openTarget, planLocally } from "@/lib/r2d2-tasks";

export type VoiceCommandResult = {
  kind: "ok" | "error";
  action: string;
  message: string;
};

type Ctx = {
  /** TTS speaker. */
  speak: (text: string) => void;
};

const NARRATIVE_FALLBACK = "Standing by, sir.";

export async function executeVoiceCommand(raw: string, ctx: Ctx): Promise<VoiceCommandResult> {
  const cmd = raw.trim();
  const lower = cmd.toLowerCase();

  // STOP / CANCEL
  if (/^(stop|cancel|silence|quiet)\b/.test(lower)) {
    window.dispatchEvent(new CustomEvent("r2d2:stop"));
    return { kind: "ok", action: "stop", message: "Stopping current activity." };
  }

  // STATUS / "what are you doing"
  if (/^(what.*doing|status|are you there)/i.test(cmd)) {
    const msg = pickStatusNarrative();
    ctx.speak(msg);
    return { kind: "ok", action: "narrate", message: msg };
  }

  // OPEN / LAUNCH
  const openMatch = lower.match(/^(open|launch|go to|visit)\s+(.+)$/);
  if (openMatch) {
    const target = openMatch[2].trim();
    const r = openTarget(target);
    if (r.ok) {
      const msg = `Opening ${target}.`;
      ctx.speak(msg);
      return { kind: "ok", action: "open", message: `${msg} (${r.url})` };
    }
    return { kind: "error", action: "open", message: r.reason || "Could not open." };
  }

  // SEARCH FOR …
  const searchMatch = lower.match(/^(search|google|look up|find on (?:google|the web))\s+(?:for\s+)?(.+)$/);
  if (searchMatch) {
    const q = searchMatch[2].trim();
    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    const msg = `Searching for ${q}.`;
    ctx.speak(msg);
    return { kind: "ok", action: "search", message: msg };
  }

  // READ ME …
  const readMatch = cmd.match(/^read me (.+)$/i);
  if (readMatch) {
    const text = readMatch[1].trim();
    ctx.speak(text);
    return { kind: "ok", action: "speak", message: `Speaking: “${text.slice(0, 40)}…”` };
  }

  // ADD TASK …
  const taskMatch = cmd.match(/^add (?:a )?task\s+(.+)$/i);
  if (taskMatch) {
    const goal = taskMatch[1].trim();
    const t = createTask(goal, planLocally(goal));
    const msg = `Added task: ${goal}.`;
    ctx.speak(msg);
    return { kind: "ok", action: "task", message: `${msg} (id ${t.id})` };
  }

  // REMEMBER …
  const memMatch = cmd.match(/^(?:remember|note(?: that)?)\s+(.+)$/i);
  if (memMatch) {
    const fact = memMatch[1].trim();
    addMemory(fact, "general");
    const msg = `Noted, sir: ${fact.slice(0, 60)}`;
    ctx.speak(msg);
    return { kind: "ok", action: "remember", message: msg };
  }

  // Default: treat as a free-form chat instruction passed back to caller via event.
  window.dispatchEvent(new CustomEvent("r2d2:chat", { detail: { message: cmd } }));
  return {
    kind: "ok",
    action: "chat",
    message: `Forwarded to chat: “${cmd.slice(0, 60)}”`,
  };
}

function pickStatusNarrative(): string {
  const phrases = [
    "Standing by, sir.",
    "All systems nominal.",
    "Awaiting your next instruction.",
    "Idle, but ready.",
  ];
  return phrases[Math.floor(Math.random() * phrases.length)] || NARRATIVE_FALLBACK;
}
