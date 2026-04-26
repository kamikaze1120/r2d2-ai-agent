/**
 * Lightweight system telemetry surfaced inside the cockpit.
 *  - JS heap (when performance.memory is available, Chromium only)
 *  - last response latency (ms) — set externally via setLastLatency
 *  - rough conversation token count — set externally
 */
import { useEffect, useState } from "react";

type PerfMemory = { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };

let _lastLatency = 0;
let _tokenCount = 0;
const _listeners = new Set<() => void>();

export function setLastLatency(ms: number) {
  _lastLatency = Math.round(ms);
  _listeners.forEach((l) => l());
}
export function setTokenCount(n: number) {
  _tokenCount = n;
  _listeners.forEach((l) => l());
}

export function useSystemStatus() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const fn = () => setTick((t) => t + 1);
    _listeners.add(fn);
    const id = setInterval(fn, 2000);
    return () => {
      _listeners.delete(fn);
      clearInterval(id);
    };
  }, []);

  const mem = (performance as unknown as { memory?: PerfMemory }).memory;
  const usedMB = mem ? Math.round(mem.usedJSHeapSize / 1048576) : null;
  const limitMB = mem ? Math.round(mem.jsHeapSizeLimit / 1048576) : null;

  return {
    tick,
    usedMB,
    limitMB,
    pctUsed: usedMB && limitMB ? Math.round((usedMB / limitMB) * 100) : null,
    lastLatency: _lastLatency,
    tokenCount: _tokenCount,
  };
}
