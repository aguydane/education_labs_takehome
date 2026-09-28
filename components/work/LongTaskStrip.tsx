"use client";

import { useEffect } from "react";
import type { LongTask } from "@/lib/types";
import { BTN_QUIET, useNow } from "./helpers";

/** The simulated task fills over this much real time, whatever its nominal duration. */
const SIMULATED_MS = 90_000;

export default function LongTaskStrip({ task, onDone }: { task: LongTask; onDone: () => void }) {
  const now = useNow(250);
  const start = Date.parse(task.startedAt);
  const progress = Number.isFinite(start) ? Math.min(1, Math.max(0, (now - start) / SIMULATED_MS)) : 1;
  const complete = progress >= 1;

  useEffect(() => {
    if (complete) onDone();
  }, [complete, onDone]);

  const pct = Math.round(progress * 100);

  return (
    <div className="shrink-0 border-t border-rule bg-panel px-5 py-2.5" data-testid="longtask-strip">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
        <div className="flex items-center gap-3 text-xs">
          <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
          <span className="min-w-0 truncate font-medium text-ink">{task.label}</span>
          <span className="shrink-0 text-ink-2">simulated · ~{task.durationMin} min</span>
          <span className="ml-auto hidden shrink-0 text-ink-2 sm:inline">Nothing is waiting on you.</span>
          <button type="button" className={BTN_QUIET} onClick={onDone} data-testid="longtask-done">
            Mark done
          </button>
        </div>
        <div
          role="progressbar"
          aria-label={`${task.label} (simulated)`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1 w-full overflow-hidden rounded-full bg-panel-2"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${pct}%` }} />
        </div>
        <p className="text-xs text-ink-2 sm:hidden">Nothing is waiting on you.</p>
      </div>
    </div>
  );
}
