"use client";

import { useSyncExternalStore } from "react";

/**
 * Walkthrough progress. Tiny external store so the header, the app shell
 * and the Tour component share it, persisted so a reload resumes the step.
 */
export type TourState = {
  active: boolean;
  stepIndex: number;
  /** ISO time the learner pressed Start; steps compare exchange timestamps to it. */
  startedAt: string | null;
  /** The learner finished or skipped it at least once. */
  done: boolean;
};

const KEY = "helm:tour";

function read(): TourState {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT, ...(JSON.parse(raw) as Partial<TourState>) };
  } catch {
    // ignore
  }
  return DEFAULT;
}

const DEFAULT: TourState = { active: false, stepIndex: 0, startedAt: null, done: false };

let state: TourState = typeof window === "undefined" ? DEFAULT : read();
const listeners = new Set<() => void>();

function set(next: TourState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  for (const l of listeners) l();
}

export const tourStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  /** Open the welcome card (step 0). */
  open: () => set({ ...state, active: true, stepIndex: 0 }),
  /** The learner pressed Start on the welcome card. */
  begin: () => set({ ...state, active: true, stepIndex: 1, startedAt: new Date().toISOString() }),
  next: () => set({ ...state, stepIndex: state.stepIndex + 1 }),
  goTo: (i: number) => set({ ...state, stepIndex: i }),
  finish: () => set({ active: false, stepIndex: 0, startedAt: null, done: true }),
};

/** First visit: the welcome card shows by itself. */
export function shouldAutoOpen(): boolean {
  return !state.done && !state.active;
}

export function useTour(): TourState {
  return useSyncExternalStore(tourStore.subscribe, tourStore.get, () => DEFAULT);
}
