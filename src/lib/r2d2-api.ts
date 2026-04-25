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
  goal?: string;
  ollama: { ok: boolean; host: string; models: string[] };
  default_model: string;
  workspace: string;
  platforms?: { etsy: boolean; shopify: boolean };
  approval_threshold?: number;
  automation?: { alive: boolean; stats: TaskStats };
  scheduler?: SchedulerStatus;
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

export type TaskStats = {
  pending: number; running: number; completed: number;
  failed: number; needs_approval: number; total: number;
};

export type Task = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: "pending" | "running" | "completed" | "failed" | "needs_approval";
  priority: number;
  confidence: number | null;
  result: Record<string, unknown> | string | null;
  error: string | null;
  attempts: number;
  max_attempts: number;
  agent: string | null;
  parent_id: string | null;
  created_at: number;
  updated_at: number;
  started_at: number | null;
  finished_at: number | null;
};

export type Niche = {
  id: string; name: string; score: number;
  keywords: string[]; status: string; created_at: number;
};

export type ProductMetrics = {
  views: number; favorites: number; sales: number;
  revenue: number; conversion: number;
};

export type Product = {
  id: string; niche_id: string; title: string; product_type: string;
  status: string; file_path: string | null;
  platform_ids: Record<string, number | string>;
  metadata: Record<string, unknown> & {
    listing?: { title: string; description: string; tags: string[];
                price_usd: number; confidence: number };
  };
  listing?: { title: string; description: string; tags: string[];
              price_usd: number; confidence: number };
  metrics?: ProductMetrics;
  created_at: number;
};

export type AnalyticsOverview = {
  overview: {
    window_days: number; views: number; sales: number;
    revenue: number; conversion: number;
  };
  daily: { day: number; revenue: number; views: number }[];
};

export type SchedulerJob = {
  name: string; interval_seconds: number; last_run: number;
  runs: number; enabled: boolean; last_error: string | null;
};
export type SchedulerStatus = { enabled: boolean; jobs: SchedulerJob[] };

export type AutomationStatus = {
  worker: { alive: boolean; stats: TaskStats };
  scheduler: SchedulerStatus;
  approval_threshold: number;
  action_allowlist: string[];
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

  // ----- Business engine -----
  listTasks: (params: { status?: string; type?: string; limit?: number } = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.type) q.set("type", params.type);
    if (params.limit) q.set("limit", String(params.limit));
    const s = q.toString();
    return req<{ tasks: Task[]; stats: TaskStats }>(`/tasks${s ? `?${s}` : ""}`);
  },
  createTask: (body: { type: string; payload?: Record<string, unknown>;
                       agent?: string; priority?: number }) =>
    req<Task>("/tasks", { method: "POST", body: JSON.stringify(body) }),
  approveTask: (id: string) =>
    req<Task>(`/tasks/${id}/approve`, { method: "POST" }),
  rejectTask: (id: string) =>
    req<Task>(`/tasks/${id}/reject`, { method: "POST" }),
  deleteTask: (id: string) =>
    req<{ ok: boolean }>(`/tasks/${id}`, { method: "DELETE" }),

  listNiches: (status?: string) =>
    req<{ niches: Niche[] }>(`/niches${status ? `?status=${status}` : ""}`),
  listProducts: (status?: string) =>
    req<{ products: Product[] }>(`/products${status ? `?status=${status}` : ""}`),
  productFileUrl: (id: string) => `${getApiBase()}/products/${id}/file`,

  analyticsOverview: (windowDays = 30) =>
    req<AnalyticsOverview>(`/analytics/overview?window_days=${windowDays}`),

  automationStatus: () => req<AutomationStatus>("/automation"),
  automationStart: () =>
    req<AutomationStatus>("/automation/start", { method: "POST" }),
  automationStop: () =>
    req<AutomationStatus>("/automation/stop", { method: "POST" }),
  automationTrigger: (jobName: string) =>
    req<{ ok: boolean; triggered: string }>(
      `/automation/trigger/${encodeURIComponent(jobName)}`, { method: "POST" }),
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
