"use client";

import type { LearnerActions } from "@/lib/learner-context";
import type { Concept, Nudge } from "@/lib/types";
import { BTN_ACCENT, BTN_QUIET_ACCENT, FOCUS } from "./helpers";

/** Quiet inline row: the learner asked why, or a pause point arrived. */
export function BeatOffer({
  nudge,
  concept,
  actions,
}: {
  nudge: Nudge;
  concept?: Concept;
  actions: LearnerActions;
}) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-md border border-dashed border-rule px-3 py-1.5 text-xs text-ink-2"
      data-testid={`beat-offer-${nudge.id}`}
    >
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <p className="min-w-0 flex-1 leading-snug">
        {concept ? <span className="text-ink">{concept.name}. </span> : null}
        {nudge.reason}
      </p>
      <button
        type="button"
        className={BTN_QUIET_ACCENT}
        onClick={() => void actions.startBeat(nudge.conceptId!, nudge.exchangeId!, nudge.id)}
        data-testid="beat-offer-take"
      >
        Take a beat
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        title="Dismiss"
        className={`-mr-1 rounded px-1.5 py-0.5 text-sm leading-none text-ink-2 hover:text-ink ${FOCUS}`}
        onClick={() => actions.dismissNudge(nudge.id)}
        data-testid="beat-offer-dismiss"
      >
        ×
      </button>
    </div>
  );
}

/** Slightly more visible: long work is running, the wait can become Studio time. */
export function StudioOffer({
  nudge,
  concept,
  actions,
}: {
  nudge: Nudge;
  concept?: Concept;
  actions: LearnerActions;
}) {
  return (
    <div
      className="rounded-lg border border-accent/40 bg-accent-soft px-3.5 py-3"
      data-testid={`studio-offer-${nudge.id}`}
    >
      <p className="text-xs font-medium text-accent-ink">
        Studio{concept ? ` · ${concept.name}` : ""}
      </p>
      <p className="mt-1 text-sm leading-snug text-ink">{nudge.reason}</p>
      <div className="mt-2.5 flex items-center gap-3">
        <button
          type="button"
          className={BTN_ACCENT}
          onClick={() =>
            void actions.enterStudio({ conceptId: nudge.conceptId!, entry: "opportunistic", nudgeId: nudge.id })
          }
          data-testid="studio-offer-book"
        >
          Book studio time
        </button>
        <button
          type="button"
          className={`rounded text-xs text-ink-2 hover:text-ink ${FOCUS}`}
          onClick={() => actions.dismissNudge(nudge.id)}
          data-testid="studio-offer-dismiss"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
