"use client";

import { useLearner } from "@/lib/learner-context";
import Hint from "@/components/ui/Hint";
import { Spinner } from "./icons";
import { HINTS, HINT_OPENS_LEFT } from "./hints";
import { BTN, confirmedCount } from "./shared";
import StateDot from "./StateDot";

/** The small set the learner is practicing, with the Prune control. */
export default function ActiveSetStrip({
  selectedId,
  onOpenConcept,
}: {
  selectedId: string | null;
  onOpenConcept: (id: string) => void;
}) {
  const { state, busy, actions } = useLearner();
  const { size } = state.activeSet;
  const ids = state.activeSet.conceptIds.filter((cid) => !!state.concepts[cid]);
  const open = Math.max(0, size - ids.length);

  return (
    <section data-testid="active-set-strip" className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <span>
            <span className="font-medium text-ink">Active set</span> · {ids.length} of {size} active
          </span>
          <Hint text={HINTS.activeSet} label="About the active set" />
        </p>
        <span className="flex items-center gap-1.5">
          <Hint text={HINTS.prune} label="About Prune" className={HINT_OPENS_LEFT} />
          <button
            type="button"
            data-testid="prune-button"
            className={BTN}
            disabled={busy.prune}
            aria-busy={busy.prune}
            onClick={() => void actions.requestPrune()}
            title="Ask Claude to propose an active set. You decide."
          >
            {busy.prune ? (
              <>
                <Spinner /> Proposing
              </>
            ) : (
              "Prune"
            )}
          </button>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {ids.map((cid) => {
          const c = state.concepts[cid];
          const n = confirmedCount(c);
          const selected = cid === selectedId;
          return (
            <button
              type="button"
              key={cid}
              data-testid={`active-chip-${cid}`}
              onClick={() => onOpenConcept(cid)}
              aria-pressed={selected}
              title={`${c.name}: ${n} confirmed recognition${n === 1 ? "" : "s"}`}
              className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                selected ? "border-accent bg-accent-soft text-accent-ink" : "border-rule bg-panel-2 text-ink hover:border-ink-2"
              }`}
            >
              <StateDot state={c.state} />
              <span className="truncate">{c.name}</span>
              <span
                className="shrink-0 rounded-full bg-panel px-1.5 text-[11px] leading-4 text-ink-2 tabular-nums"
                aria-label={`${n} confirmed recognition${n === 1 ? "" : "s"}`}
              >
                {n}
              </span>
            </button>
          );
        })}
        {Array.from({ length: open }, (_, i) => (
          <span
            key={`open-${i}`}
            className="rounded-full border border-dashed border-rule px-2.5 py-1 text-xs text-ink-2"
          >
            open slot
          </span>
        ))}
      </div>
    </section>
  );
}
