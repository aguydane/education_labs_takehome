"use client";

import { useMemo, useState } from "react";
import type { LearnerState } from "@/lib/types";

/** One confirmed-recognition event noticed while the panel was mounted. */
export type Flash = { n: number; at: number };
export type Flashes = Readonly<Record<string, Flash>>;

type Track = {
  persona: string;
  sig: string;
  counts: Record<string, number>;
  flashes: Flashes;
};

function countsOf(concepts: LearnerState["concepts"]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of Object.values(concepts)) {
    out[c.id] = c.recognitions.filter((r) => r.status === "confirmed").length;
  }
  return out;
}

function sigOf(counts: Record<string, number>): string {
  return Object.keys(counts)
    .sort()
    .map((k) => `${k}:${counts[k]}`)
    .join("|");
}

/**
 * Compares confirmed-recognition counts between renders and records a flash
 * for every concept whose count went up. Uses the "adjust state while
 * rendering" pattern, so there is no effect and no extra commit. A persona
 * switch resets tracking instead of flashing everything.
 */
export function useRecognitionFlashes(state: LearnerState, now: number): Flashes {
  const persona = state.persona.id;
  const counts = useMemo(() => countsOf(state.concepts), [state.concepts]);
  const sig = useMemo(() => sigOf(counts), [counts]);
  const [track, setTrack] = useState<Track>(() => ({ persona, sig, counts, flashes: {} }));

  if (track.persona !== persona || track.sig !== sig) {
    const flashes: Record<string, Flash> = {};
    if (track.persona === persona) {
      Object.assign(flashes, track.flashes);
      for (const [cid, n] of Object.entries(counts)) {
        const before = track.counts[cid];
        if (before !== undefined && n > before) {
          flashes[cid] = { n: (flashes[cid]?.n ?? 0) + 1, at: now };
        }
      }
    }
    setTrack({ persona, sig, counts, flashes });
    return flashes;
  }
  return track.flashes;
}

export const RECENT_MS = 120_000;

/** Did this concept gain a confirmed recognition in the last two minutes? */
export function recentlyRecognized(
  recognitions: { status: string; ts: string }[],
  flash: Flash | undefined,
  now: number,
): boolean {
  if (flash && now - flash.at < RECENT_MS) return true;
  return recognitions.some((r) => {
    if (r.status !== "confirmed") return false;
    const t = Date.parse(r.ts);
    return !Number.isNaN(t) && now - t < RECENT_MS && now - t > -RECENT_MS;
  });
}
