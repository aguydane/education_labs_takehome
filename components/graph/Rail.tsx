"use client";

import { useLearner } from "@/lib/learner-context";
import { pendingNudges } from "@/lib/pipeline/triggers";
import { recentlyRecognized, type Flashes } from "./flashes";
import { ChevronLeft, InboxIcon, StudioIcon } from "./icons";
import {
  DAY_LONG,
  HOLLOW,
  ICON_BTN,
  STATE_LABEL,
  STATE_OPACITY,
  abbreviate,
  blockRange,
  blockShort,
  stateVar,
} from "./shared";

/**
 * The collapsed graph panel. Not a placeholder: it carries what matters while
 * the learner is working — the active set, what is waiting, and the next
 * Studio block — without asking for attention.
 */
export default function Rail({
  flashes,
  now,
  onOpenConcept,
}: {
  flashes: Flashes;
  now: number;
  onOpenConcept: (id: string) => void;
}) {
  const { state, studio, actions } = useLearner();
  const waiting = pendingNudges(state).length;
  const next = state.calendar[0];
  const activeIds = state.activeSet.conceptIds.filter((cid) => !!state.concepts[cid]);
  const first = activeIds[0];
  const studioBlocked = state.ui.mode === "studio" || !!studio?.entering;
  const nextConcept = next ? state.concepts[next.conceptId ?? first ?? ""] : undefined;

  return (
    <nav data-testid="graph-rail" aria-label="Learning rail" className="flex h-full flex-col items-center gap-3 py-3">
      <button
        type="button"
        data-testid="graph-toggle"
        onClick={actions.toggleGraph}
        aria-label="Expand your map"
        aria-expanded={false}
        title="Expand your map"
        className={ICON_BTN}
      >
        <ChevronLeft />
      </button>

      <div className="h-px w-8 bg-rule" />

      <ul className="flex flex-col items-center gap-2.5" aria-label="Active concepts">
        {activeIds.map((cid) => {
          const c = state.concepts[cid];
          const flash = flashes[cid];
          const pulse = recentlyRecognized(c.recognitions, flash, now);
          return (
            <li key={`${cid}:${flash?.n ?? 0}`}>
              <button
                type="button"
                data-testid={`rail-chip-${cid}`}
                onClick={() => onOpenConcept(cid)}
                title={c.name}
                aria-label={`${c.name}, ${STATE_LABEL[c.state].toLowerCase()}. Open in your map.`}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-[11px] font-semibold tracking-tight outline-offset-2 outline-rule hover:outline ${
                  pulse ? "helm-pulse" : ""
                }`}
                // Same encoding as the map: hollow ring while only noticed, filled once decided.
                style={
                  HOLLOW[c.state]
                    ? { borderColor: stateVar(c.state), background: "var(--panel)", color: "var(--ink)", opacity: STATE_OPACITY[c.state] }
                    : { borderColor: stateVar(c.state), background: stateVar(c.state), color: "var(--panel)", opacity: STATE_OPACITY[c.state] }
                }
              >
                {abbreviate(c.name)}
              </button>
            </li>
          );
        })}
        {activeIds.length === 0 ? (
          <li className="px-1 text-center text-[10px] leading-tight text-ink-2">No active set</li>
        ) : null}
      </ul>

      {waiting > 0 ? (
        <button
          type="button"
          data-testid="rail-inbox"
          onClick={actions.toggleGraph}
          aria-label={`${waiting} waiting. Open your map.`}
          title="Offers waiting"
          className={`relative ${ICON_BTN}`}
        >
          <InboxIcon />
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium leading-none text-panel tabular-nums">
            {waiting}
          </span>
        </button>
      ) : null}

      <div className="mt-auto flex flex-col items-center gap-2.5">
        {next ? (
          <div
            className="text-center text-[10px] leading-tight text-ink-2"
            title={`Next Studio block: ${DAY_LONG[next.dayOfWeek] ?? ""} ${blockRange(next)}${
              nextConcept ? ` · ${nextConcept.name}` : ""
            }`}
          >
            Next
            <br />
            <span className="font-medium text-ink">{blockShort(next)}</span>
          </div>
        ) : null}
        <button
          type="button"
          data-testid="rail-studio"
          disabled={!first || studioBlocked}
          onClick={() => {
            if (first) void actions.enterStudio({ conceptId: first, entry: "manual" });
          }}
          title={first ? "Book studio time on your first active idea" : "Choose an active set first"}
          className="flex w-14 flex-col items-center gap-1 rounded-md py-1.5 text-[10px] text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <StudioIcon className="h-5 w-5" />
          Studio
        </button>
      </div>
    </nav>
  );
}
