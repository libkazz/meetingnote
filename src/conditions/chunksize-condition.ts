// Condition object for deciding when to send a segment
// Exported so the thresholds are easy to tweak in one place.

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

const cfg = {
  minSeconds: 10,
  maxSeconds: 30,
  requiredSilenceMs: 2000,
  chunkMs: 1000,
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
