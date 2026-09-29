"use client";

import { useLearner } from "@/lib/learner-context";
import Hint from "@/components/ui/Hint";
import { Spinner } from "./icons";
import { HINTS, HINT_OPENS_LEFT } from "./hints";
import { BTN, DAY_LONG, DAY_SHORT, blockRange } from "./shared";

const WEEKDAYS = [1, 2, 3, 4, 5];

/** The learning budget and the week's Studio block(s), as colleagues would see them. */
export default function CalendarStrip() {
  const { state, busy, studio, actions } = useLearner();
  const blocks = state.calendar;
  const first = blocks[0];
  const fallback = state.activeSet.conceptIds.find((cid) => !!state.concepts[cid]);
  const conceptFor = (conceptId?: string) => state.concepts[conceptId ?? fallback ?? ""];
  const target = first ? conceptFor(first.conceptId) : undefined;
  const entering = busy.summarize || !!studio?.entering;
  const inStudio = state.ui.mode === "studio";

  return (
    <section data-testid="calendar-strip" className="shrink-0 border-b border-rule px-4 py-2">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <span>
            Learning budget <span className="font-medium text-ink tabular-nums">{state.persona.budgetPct}%</span>
          </span>
          <Hint text={HINTS.budget} label="About the learning budget" />
        </p>
        {first ? (
          <span className="flex items-center gap-1.5">
            <Hint text={HINTS.studio} label="About Studio blocks" className={HINT_OPENS_LEFT} />
            <button
              type="button"
              data-testid="calendar-jump"
              className={BTN}
              disabled={!target || inStudio || entering}
              onClick={() => {
                if (target) void actions.enterStudio({ conceptId: target.id, entry: "scheduled" });
              }}
              title="Simulate the block arriving: save where you were, then enter Studio"
            >
              {entering ? (
                <>
                  <Spinner /> Saving where you were
                </>
              ) : (
                "Jump to your Studio block"
              )}
            </button>
          </span>
        ) : null}
      </div>

      {blocks.length === 0 ? (
        <p className="mt-2 text-xs text-ink-2">No Studio block is scheduled this week.</p>
      ) : (
        <div className="mt-2 flex gap-1" aria-label="This week">
          {WEEKDAYS.map((d) => {
            const dayBlocks = blocks.filter((b) => b.dayOfWeek === d);
            if (dayBlocks.length === 0) {
              return (
                <div
                  key={d}
                  className="min-w-0 flex-1 rounded-md border border-rule px-1.5 py-1 text-xs text-ink-2"
                >
                  {DAY_SHORT[d]}
                </div>
              );
            }
            return (
              <div key={d} className="flex min-w-0 flex-[4] flex-col gap-1">
                {dayBlocks.map((b, i) => {
                  const c = conceptFor(b.conceptId);
                  const label = `Studio: ${c?.name ?? "open practice"}`;
                  return (
                    <div
                      key={`${b.start}-${i}`}
                      className="min-w-0 rounded-md border border-accent bg-accent-soft px-2 py-1 text-accent-ink"
                      title={`${DAY_LONG[d]} ${blockRange(b)} · ${label} · colleagues see: Busy`}
                    >
                      <div className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="shrink-0">
                          <span className="font-medium">{DAY_SHORT[d]}</span>{" "}
                          <span className="tabular-nums">{blockRange(b)}</span>
                        </span>
                        <span className="truncate text-[11px] text-ink-2">colleagues see: Busy</span>
                      </div>
                      <div className="truncate text-xs">{label}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
      {blocks.some((b) => b.dayOfWeek === 0 || b.dayOfWeek === 6) ? (
        <p className="mt-1 text-[11px] text-ink-2">
          Also on the weekend:{" "}
          {blocks
            .filter((b) => b.dayOfWeek === 0 || b.dayOfWeek === 6)
            .map((b) => `${DAY_SHORT[b.dayOfWeek]} ${blockRange(b)}`)
            .join(", ")}
        </p>
      ) : null}
    </section>
  );
}
