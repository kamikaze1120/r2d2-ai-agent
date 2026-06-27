/**
 * R2D2 API client.
 * Talks to the local Python agent via HTTP. The base URL is user-configurable
 * (localhost by default, or a tunnel URL like https://xyz.trycloudflare.com).
 */

const STORAGE_KEY      = "r2d2.apiBase";
const MODEL_KEY        = "r2d2.model";
const PROVIDER_KEY     = "r2d2.llmProvider";
const ELEVENLABS_KEY   = "r2d2.elevenLabsKey";
const VOICE_ID_KEY     = "r2d2.voiceId";

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
export function setModel(m: string) { localStorage.setItem(MODEL_KEY, m); }

export function getLLMProvider(): string {
  if (typeof window === "undefined") return "ollama";
  return localStorage.getItem(PROVIDER_KEY) || "ollama";
}
export function setLLMProvider(p: string) { localStorage.setItem(PROVIDER_KEY, p); }

export function getElevenLabsKey(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(ELEVENLABS_KEY) || "";
}
export function setElevenLabsKey(k: string) { localStorage.setItem(ELEVENLABS_KEY, k); }

export function getVoiceId(): string {
  if (typeof window === "undefined") return "JBFqnCBsd6RMkjVDRZzb";
  return localStorage.getItem(VOICE_ID_KEY) || "JBFqnCBsd6RMkjVDRZzb";
}
export function setVoiceId(id: string) { localStorage.setItem(VOICE_ID_KEY, id); }

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

export type LLMConfig = {
  provider: string;           // ollama | anthropic | openai | gemini | custom
  model: string;
  capability_tier: "basic" | "standard" | "advanced";
  ollama_host?: string;
  openai_base_url?: string;
  custom_base_url?: string;
  anthropic_key_set?: boolean;
  openai_key_set?: boolean;
  gemini_key_set?: boolean;
  custom_key_set?: boolean;
};

export type Health = {
  ok: boolean;
  version: string;
  goal?: string;
  llm: LLMConfig & { ok: boolean; models: string[] };
  ollama: { ok: boolean | null; host: string; models: string[] };
  agents: string[];
  tools: string[];
  workspace: string;
  platforms?: { etsy: boolean; shopify: boolean; pinterest: boolean };
  approval_threshold?: number;
  dry_run?: boolean;
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
  funnel: { views: number; favorites: number; sales: number; revenue: number };
  by_niche: { niche_id: string; name: string; revenue: number;
              sales: number; views: number }[];
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
  dry_run: boolean;
};

export type AuditEntry = {
  id: number; ts: number; actor: string; action: string;
  target: string | null; outcome: "ok" | "blocked" | "dry_run" | "error";
  detail: Record<string, unknown>;
};

export type MarketingItem = {
  id: string; product_id: string; ts: number;
  status: "queued" | "posted"; posted_at?: number;
  title?: string; description?: string; hashtags?: string[];
  hook?: string; beats?: string[]; cta?: string;
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

  patchListing: (id: string, patch: Partial<{ title: string;
        description: string; tags: string[]; price_usd: number;
        confidence: number }>) =>
    req<{ ok: boolean; listing: Product["listing"] }>(
      `/products/${id}/listing`,
      { method: "PATCH", body: JSON.stringify(patch) }),

  automationStatus: () => req<AutomationStatus>("/automation"),
  automationStart: () =>
    req<AutomationStatus>("/automation/start", { method: "POST" }),
  automationStop: () =>
    req<AutomationStatus>("/automation/stop", { method: "POST" }),
  automationTrigger: (jobName: string) =>
    req<{ ok: boolean; triggered: string }>(
      `/automation/trigger/${encodeURIComponent(jobName)}`, { method: "POST" }),
  patchJob: (name: string, body: { interval_seconds?: number;
                                    enabled?: boolean }) =>
    req<AutomationStatus>(`/automation/jobs/${encodeURIComponent(name)}`,
      { method: "PATCH", body: JSON.stringify(body) }),
  patchSafety: (body: { dry_run?: boolean; approval_threshold?: number;
                         action_allowlist?: string[] }) =>
    req<AutomationStatus>("/automation/safety",
      { method: "PATCH", body: JSON.stringify(body) }),

  audit: (params: { limit?: number; action?: string; outcome?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.limit) q.set("limit", String(params.limit));
    if (params.action) q.set("action", params.action);
    if (params.outcome) q.set("outcome", params.outcome);
    const s = q.toString();
    return req<{ entries: AuditEntry[] }>(`/audit${s ? `?${s}` : ""}`);
  },

  marketingQueue: (kind: "pinterest" | "tiktok") =>
    req<{ items: MarketingItem[]; pinterest_configured: boolean }>(
      `/marketing/queue/${kind}`),
  marketingMarkPosted: (kind: "pinterest" | "tiktok", id: string) =>
    req<{ ok: boolean }>(
      `/marketing/queue/${kind}/${encodeURIComponent(id)}/posted`,
      { method: "POST" }),

  // ----- LLM config -----
  getLLMConfig: () => req<LLMConfig>("/llm-config"),
  patchLLMConfig: (body: {
    provider?: string;
    model?: string;
    api_key?: string;
    base_url?: string;
    ollama_host?: string;
  }) => req<LLMConfig>("/llm-config", { method: "PATCH", body: JSON.stringify(body) }),
  listModels: () => req<{ provider: string; models: string[]; capability_tier: string }>("/models"),

  // ----- Host filesystem & launcher -----
  hostRoots: () =>
    req<{ restrict: boolean; allowed_roots: string[] }>("/host/fs/roots"),
  hostFsList: (path: string) =>
    req<{ path: string; entries: { name: string; kind: "file" | "directory"; size: number; modified: number }[] }>(
      "/host/fs/list",
      { method: "POST", body: JSON.stringify({ path }) }),
  hostFsRead: (path: string, max_bytes = 200_000) =>
    req<{ path: string; text?: string; binary?: boolean; bytes?: number }>(
      "/host/fs/read",
      { method: "POST", body: JSON.stringify({ path, max_bytes }) }),
  hostFsWrite: (path: string, content: string) =>
    req<{ ok: boolean; path: string }>(
      "/host/fs/write",
      { method: "POST", body: JSON.stringify({ path, content }) }),
  hostLaunch: (target: string) =>
    req<{ ok: boolean; target: string }>(
      "/host/launch",
      { method: "POST", body: JSON.stringify({ target }) }),
};

export type ChatEvent =
  | { type: "session";     session_id: string }
  | { type: "token";       text: string }                           // per-token stream
  | { type: "thought";     step: number; text: string }
  | { type: "tool_call";   step: number; tool: string; args: Record<string, unknown> }
  | { type: "tool_result"; step: number; tool: string; result: string }
  | { type: "final";       text: string }
  | { type: "error";       message: string };

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
