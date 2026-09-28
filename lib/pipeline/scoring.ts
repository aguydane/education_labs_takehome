import { SIGNAL_HALF_LIFE_DAYS, type Concept, type Confidence } from "@/lib/types";
import { daysBetween } from "@/lib/util";

/** Signal decays with a 14-day half-life from the last time the concept was seen. */
export function effectiveSignal(c: Concept, now: string): number {
  const days = daysBetween(c.lastSeen, now);
  return c.signal * Math.pow(0.5, days / SIGNAL_HALF_LIFE_DAYS);
}

/** Decay an existing signal to `now` before adding to it. */
export function decayedTo(signal: number, lastSeen: string, now: string): number {
  return signal * Math.pow(0.5, daysBetween(lastSeen, now) / SIGNAL_HALF_LIFE_DAYS);
}

export function confidenceValue(c: Confidence): number {
  switch (c) {
    case "high":
      return 0.9;
    case "medium":
      return 0.5;
    case "low":
      return 0.15;
    default:
      return 0.3;
  }
}

/** impact × (1 − confidence) × signal. The number Prune explains in words. */
export function candidateScore(c: Concept, now: string): number {
  return (c.impact / 5) * (1 - confidenceValue(c.confidence)) * effectiveSignal(c, now);
}

export function clampImpact(n: number): 1 | 2 | 3 | 4 | 5 {
  const r = Math.round(n);
  return (r < 1 ? 1 : r > 5 ? 5 : r) as 1 | 2 | 3 | 4 | 5;
}
