/**
 * Browser-side persistent memory for R2D2.
 *
 * Stores facts the user wants R2D2 to remember across sessions. Independent of
 * the Python agent's `/memories` endpoint so it works fully offline.
 *
 * Schema: { id, fact, category, timestamp }
 */

export type MemoryCategory =
  | "preferences"
  | "tasks"
  | "files"
  | "people"
  | "schedule"
  | "general";

export const MEMORY_CATEGORIES: MemoryCategory[] = [
  "preferences",
  "tasks",
  "files",
  "people",
  "schedule",
  "general",
];

export type R2D2Memory = {
  id: string;
  fact: string;
  category: MemoryCategory;
  timestamp: number;
};

const KEY = "r2d2_memory";

export function loadMemories(): R2D2Memory[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMemories(items: R2D2Memory[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

export function addMemory(fact: string, category: MemoryCategory = "general"): R2D2Memory {
  const m: R2D2Memory = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fact: fact.trim(),
    category,
    timestamp: Date.now(),
  };
  const cur = loadMemories();
  cur.unshift(m);
  saveMemories(cur.slice(0, 200));
  return m;
}

export function deleteMemory(id: string) {
  saveMemories(loadMemories().filter((m) => m.id !== id));
}

export function updateMemory(id: string, patch: Partial<Pick<R2D2Memory, "fact" | "category">>) {
  saveMemories(
    loadMemories().map((m) =>
      m.id === id ? { ...m, ...patch, timestamp: Date.now() } : m,
    ),
  );
}

/**
 * Build a small context block to inject into LLM prompts.
 * Keeps the size bounded (≤ 12 most recent or category-matching items).
 */
export function buildMemoryContext(query?: string): string {
  const items = loadMemories();
  if (items.length === 0) return "";
  const q = (query || "").toLowerCase();
  const ranked = items
    .map((m) => ({
      m,
      score: q && m.fact.toLowerCase().includes(q) ? 2 : 1,
    }))
    .sort((a, b) => b.score - a.score || b.m.timestamp - a.m.timestamp)
    .slice(0, 12)
    .map(({ m }) => `- [${m.category}] ${m.fact}`);
  return `# What R2D2 knows about you\n${ranked.join("\n")}`;
}

// ---------------- Scratchpad ----------------

const SCRATCH_KEY = "r2d2_scratchpad";

export function getScratchpad(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(SCRATCH_KEY) || "";
}

export function setScratchpad(text: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SCRATCH_KEY, text);
}
