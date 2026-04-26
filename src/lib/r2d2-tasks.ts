/**
 * Local task queue + planner for R2D2 in-browser autonomy.
 * Independent from the Python agent's /tasks API so it works offline.
 */

export type R2D2TaskStatus = "pending" | "running" | "done" | "failed";

export type R2D2LocalTask = {
  id: string;
  goal: string;
  subtasks: { id: string; text: string; status: R2D2TaskStatus; output?: string }[];
  status: R2D2TaskStatus;
  createdAt: number;
  updatedAt: number;
  output: string[];
};

const KEY = "r2d2_local_tasks";
const ACTION_LOG_KEY = "r2d2_action_log";

export type ActionLogEntry = {
  id: string;
  ts: number;
  action: string;
  detail?: string;
};

const safeRead = <T>(k: string, fb: T): T => {
  if (typeof window === "undefined") return fb;
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fb;
  } catch {
    return fb;
  }
};
const safeWrite = (k: string, v: unknown) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(k, JSON.stringify(v));
};

export const loadTasks = (): R2D2LocalTask[] => safeRead<R2D2LocalTask[]>(KEY, []);
export const saveTasks = (t: R2D2LocalTask[]) => safeWrite(KEY, t.slice(0, 50));

export function createTask(goal: string, subtaskTexts: string[]): R2D2LocalTask {
  const t: R2D2LocalTask = {
    id: `t-${Date.now()}`,
    goal,
    subtasks: subtaskTexts.map((text, i) => ({
      id: `s-${Date.now()}-${i}`,
      text,
      status: "pending",
    })),
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    output: [],
  };
  saveTasks([t, ...loadTasks()]);
  return t;
}

export function updateTask(id: string, patch: Partial<R2D2LocalTask>) {
  saveTasks(loadTasks().map((t) => (t.id === id ? { ...t, ...patch, updatedAt: Date.now() } : t)));
}

export function updateSubtask(taskId: string, subId: string, patch: Partial<R2D2LocalTask["subtasks"][number]>) {
  saveTasks(
    loadTasks().map((t) =>
      t.id !== taskId
        ? t
        : {
            ...t,
            updatedAt: Date.now(),
            subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, ...patch } : s)),
          },
    ),
  );
}

export function deleteTask(id: string) {
  saveTasks(loadTasks().filter((t) => t.id !== id));
}

export function appendOutput(id: string, line: string) {
  saveTasks(
    loadTasks().map((t) =>
      t.id !== id ? t : { ...t, output: [...t.output, line], updatedAt: Date.now() },
    ),
  );
}

// ---------------- Action log ----------------

export const loadActionLog = (): ActionLogEntry[] => safeRead<ActionLogEntry[]>(ACTION_LOG_KEY, []);

export function logAction(action: string, detail?: string): ActionLogEntry {
  const e: ActionLogEntry = {
    id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: Date.now(),
    action,
    detail,
  };
  const cur = loadActionLog();
  cur.unshift(e);
  safeWrite(ACTION_LOG_KEY, cur.slice(0, 200));
  return e;
}

/**
 * Naive heuristic planner — splits a goal into 2-4 subtasks based on simple rules.
 * Good enough as a fallback when the LLM agent is offline.
 */
export function planLocally(goal: string): string[] {
  const g = goal.toLowerCase();
  if (g.includes("organize") && g.includes("downloads")) {
    return [
      "Request access to the Downloads folder",
      "Group files by extension",
      "Move files into typed subfolders",
      "Report a summary",
    ];
  }
  if (g.includes("open ") || g.includes("launch ")) {
    return ["Resolve the target URL/app", "Open it in a new tab"];
  }
  if (g.includes("find ") && g.includes(".pdf")) {
    return ["Request access to the search folder", "Walk the folder tree", "List matching PDFs"];
  }
  return [
    "Understand the goal",
    "Identify the resources required",
    "Execute the work",
    "Report results",
  ];
}

/** Best-effort URL/app launcher. Maps a name to a URL when possible. */
export function openTarget(name: string): { ok: boolean; url?: string; reason?: string } {
  const n = name.trim().toLowerCase().replace(/^open\s+|^launch\s+/, "");
  const map: Record<string, string> = {
    youtube: "https://www.youtube.com",
    spotify: "https://open.spotify.com",
    gmail: "https://mail.google.com",
    github: "https://github.com",
    twitter: "https://x.com",
    x: "https://x.com",
    google: "https://www.google.com",
    chatgpt: "https://chat.openai.com",
    claude: "https://claude.ai",
    notion: "https://www.notion.so",
    linkedin: "https://www.linkedin.com",
    reddit: "https://www.reddit.com",
  };
  let url = map[n];
  if (!url) {
    if (/^https?:\/\//.test(n)) url = n;
    else if (n.includes(".")) url = `https://${n}`;
    else url = `https://www.google.com/search?q=${encodeURIComponent(n)}`;
  }
  try {
    window.open(url, "_blank", "noopener,noreferrer");
    return { ok: true, url };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}
