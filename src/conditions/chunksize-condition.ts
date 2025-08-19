// Condition object for deciding when to send a segment
// Exported so the thresholds are easy to tweak in one place.
import { readEnv } from "../lib/api/n8n-common";

export type ChunksizeCondition = Readonly<{
  minSeconds: number;
  maxSeconds: number;
  requiredSilenceMs: number;
  chunkMs: number;
  // Returns true if a segment should be sent now
  shouldSend: (sinceSeconds: number, silentMs: number) => boolean;
  // Optional: provide a human-readable reason label for logging/metadata
  reason?: (sinceSeconds: number, silentMs: number) => string | null;
}>;

function readNumberEnv(name: string, fallback: number): number {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

// Defaults chosen for balanced latency vs. accuracy
const defaults = {
  minSeconds: 10,
  maxSeconds: 30,
  requiredSilenceMs: 2000,
  chunkMs: 1000,
} as const;

// Read from env (VITE_ variables). Chunk timeslice is also configurable.
const cfg = {
  minSeconds: readNumberEnv("CHUNK_MIN_SECONDS", defaults.minSeconds),
  maxSeconds: readNumberEnv("CHUNK_MAX_SECONDS", defaults.maxSeconds),
  requiredSilenceMs: readNumberEnv("CHUNK_REQUIRED_SILENCE_MS", defaults.requiredSilenceMs),
  chunkMs: readNumberEnv("CHUNK_MS", defaults.chunkMs),
} as const;

function reason(sinceSeconds: number, silentMs: number): string | null {
  if (sinceSeconds >= cfg.maxSeconds) return "max-seconds";
  if (sinceSeconds >= cfg.minSeconds && silentMs >= cfg.requiredSilenceMs) return "min-seconds-and-silence";
  return null;
}

function shouldSend(sinceSeconds: number, silentMs: number): boolean {
  return Boolean(reason(sinceSeconds, silentMs));
}

export const chunsizeCondition: ChunksizeCondition = Object.freeze({
  ...cfg,
  reason,
  shouldSend,
});
