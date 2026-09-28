"use client";

import { useSyncExternalStore } from "react";

/**
 * A coarse shared clock. Components read "now" from here instead of calling
 * Date.now() during render, so render stays pure and time-based UI (the rail
 * pulse, "4m ago") refreshes on its own.
 */

const TICK_MS = 15_000;

let current = Date.now();
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function tick() {
  current = Date.now();
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (!timer) {
    current = Date.now();
    timer = setInterval(tick, TICK_MS);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

function getSnapshot(): number {
  return current;
}

export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
