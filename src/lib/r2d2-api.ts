/**
 * R2D2 API client.
 * Talks to the local Python agent via HTTP. The base URL is user-configurable
 * (localhost by default, or a tunnel URL like https://xyz.trycloudflare.com).
 */

const STORAGE_KEY = "r2d2.apiBase";
const MODEL_KEY = "r2d2.model";

export function getApiBase(): string {
  if (typeof window === "undefined") return "http://localhost:8000";
  return localStorage.getItem(STORAGE_KEY) || "http://localhost:8000";
}

export function setApiBase(url: string) {
  localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ""));
}

export function getModel(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(MODEL_KEY) || "";
}

export function setModel(m: string) {
  localStorage.setItem(MODEL_KEY, m);
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(getApiBase() + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

export type Health = {
  ok: boolean;
  version: string;
  ollama: { ok: boolean; host: string; models: string[] };
  default_model: string;
  workspace: string;
};

export type ToolSpec = {
  name: string;
  description: string;
  parameters: { properties?: Record<string, { type: string; description?: string }> };
};

export type SessionSummary = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  message_count: number;
};

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  meta?: Record<string, unknown>;
};

export type Session = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
  messages: ChatMessage[];
};

export type Memory = {
  id: string;
  text: string;
  tags: string[];
  created_at: number;
};

export const api = {
  health: () => req<Health>("/health"),
  listTools: () => req<{ tools: ToolSpec[] }>("/tools"),
  listSessions: () => req<{ sessions: SessionSummary[] }>("/sessions"),
  getSession: (id: string) => req<Session>(`/sessions/${id}`),
  createSession: (title?: string) =>
    req<Session>("/sessions", { method: "POST", body: JSON.stringify({ title }) }),
  deleteSession: (id: string) =>
    req<{ ok: boolean }>(`/sessions/${id}`, { method: "DELETE" }),
  listMemories: () => req<{ memories: Memory[] }>("/memories"),
  addMemory: (text: string, tags: string[] = []) =>
    req<Memory>("/memories", { method: "POST", body: JSON.stringify({ text, tags }) }),
  deleteMemory: (id: string) =>
    req<{ ok: boolean }>(`/memories/${id}`, { method: "DELETE" }),
};

export type ChatEvent =
  | { type: "session"; session_id: string }
  | { type: "thought"; step: number; text: string }
  | { type: "tool_call"; step: number; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; step: number; tool: string; result: string }
  | { type: "final"; text: string }
  | { type: "error"; message: string };

/** Streams NDJSON chat events from POST /chat. */
export async function streamChat(
  body: { session_id?: string; message: string; model?: string },
  onEvent: (ev: ChatEvent) => void,
): Promise<void> {
  const r = await fetch(getApiBase() + "/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok || !r.body) throw new Error(`${r.status} ${await r.text()}`);
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line) continue;
      try {
        onEvent(JSON.parse(line) as ChatEvent);
      } catch {
        // ignore partial lines
      }
    }
  }
}
