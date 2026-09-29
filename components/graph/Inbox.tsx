"use client";

import { useLearner } from "@/lib/learner-context";
import Hint from "@/components/ui/Hint";
import { pendingNudges } from "@/lib/pipeline/triggers";
import type { Nudge } from "@/lib/types";
import { HINTS } from "./hints";
import { BTN } from "./shared";
import StateDot from "./StateDot";

/**
 * Everything the rail badge counts, except prune proposals (which have their
 * own panel). Quiet: one line per item, and "Not now" is always there.
 */
export default function Inbox({ onOpenConcept }: { onOpenConcept: (id: string) => void }) {
  const { state, studio, actions } = useLearner();
  const items = pendingNudges(state).filter((n) => n.kind !== "prune-proposal");
  if (items.length === 0) return null;
  const inStudio = state.ui.mode === "studio" || !!studio?.entering;

  const primary = (n: Nudge) => {
    const c = n.conceptId ? state.concepts[n.conceptId] : undefined;
    if (!c) return null;
    if (n.kind === "beat-offer" && n.exchangeId) {
      const exchangeId = n.exchangeId;
      return (
        <button
          type="button"
          className={BTN}
          disabled={inStudio}
          onClick={() => void actions.startBeat(c.id, exchangeId, n.id)}
        >
          Take a beat
        </button>
      );
    }
    if (n.kind === "studio-offer") {
      return (
        <button
          type="button"
          className={BTN}
          disabled={inStudio}
          onClick={() =>
            void actions.enterStudio({
              conceptId: c.id,
              entry: state.longTask ? "opportunistic" : "manual",
              nudgeId: n.id,
            })
          }
        >
          {state.longTask ? "Use the wait" : "Open Studio"}
        </button>
      );
    }
    return (
      <button type="button" className={BTN} onClick={() => onOpenConcept(c.id)}>
        Look
      </button>
    );
  };

  return (
    <section data-testid="graph-inbox" className="border-b border-rule px-4 py-2.5">
      <h3 className="flex items-center gap-1.5 text-xs text-ink-2">
        Waiting for you · {items.length}
        <Hint text={HINTS.inbox} label="About these offers" />
      </h3>
      <ul className="mt-1.5 space-y-2">
        {items.map((n) => {
          const c = n.conceptId ? state.concepts[n.conceptId] : undefined;
          return (
            <li key={n.id} data-testid={`inbox-item-${n.id}`} className="flex items-start gap-2">
              {c ? (
                <StateDot state={c.state} className="mt-1" />
              ) : (
                <span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ink-2" />
              )}
              <div className="min-w-0 flex-1 text-xs">
                <p className="text-ink">{n.reason}</p>
                {c ? (
                  <button
                    type="button"
                    className="text-ink-2 underline-offset-2 hover:text-ink hover:underline"
                    onClick={() => onOpenConcept(c.id)}
                  >
                    {c.name}
                  </button>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                {primary(n)}
                <button type="button" className={BTN} onClick={() => actions.dismissNudge(n.id)}>
                  Not now
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
