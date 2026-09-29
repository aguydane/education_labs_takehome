"use client";

/**
 * The rung ladder (modeling → coaching → fading) with the current rung
 * highlighted, and the two controls that move along it.
 */

import Hint from "@/components/ui/Hint";
import type { Rung } from "@/lib/types";
import { HINTS, RUNGS, btnQuiet, rungMeaning } from "./ui";

type Props = {
  rung: Rung;
  /** Both controls are off while Claude is replying or the session can't take turns. */
  locked: boolean;
  onMoreHelp: () => void;
  onLetMeTry: () => void;
};

export default function RungControl({ rung, locked, onMoreHelp, onLetMeTry }: Props) {
  const idx = RUNGS.findIndex((r) => r.id === rung);
  const lower = idx > 0 ? RUNGS[idx - 1] : undefined;
  const higher = idx < RUNGS.length - 1 ? RUNGS[idx + 1] : undefined;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <ol
        aria-label="Support level"
        data-testid="studio-rung"
        data-rung={rung}
        className="flex items-center gap-1 text-xs"
      >
        {RUNGS.map((r, i) => {
          const current = r.id === rung;
          return (
            <li key={r.id} className="flex items-center gap-1">
              {i > 0 ? (
                <span aria-hidden className="text-ink-2">
                  {"→"}
                </span>
              ) : null}
              <span
                title={r.meaning}
                aria-current={current ? "step" : undefined}
                className={
                  current
                    ? "rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-ink"
                    : "rounded-full px-2 py-0.5 text-ink-2"
                }
              >
                {r.id}
                <span className="sr-only">: {r.meaning}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <Hint text={HINTS.rungs} label="About support levels" className="shrink-0" />

      <span className="text-xs text-ink-2">{rungMeaning(rung)}</span>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={onMoreHelp}
          disabled={locked || !lower}
          title={lower ? `Move to ${lower.id}: ${lower.meaning}` : "Already at the most help"}
          data-testid="studio-more-help"
          className={btnQuiet}
        >
          More help
        </button>
        <button
          type="button"
          onClick={onLetMeTry}
          disabled={locked || !higher}
          title={higher ? `Move to ${higher.id}: ${higher.meaning}` : "Already working on your own"}
          data-testid="studio-let-me-try"
          className={btnQuiet}
        >
          Let me try
        </button>
      </div>
    </div>
  );
}
