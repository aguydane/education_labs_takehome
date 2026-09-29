"use client";

import { useState, type ReactNode } from "react";
import { useLearner } from "@/lib/learner-context";
import Hint from "@/components/ui/Hint";
import type { Nudge, PruneProposal } from "@/lib/types";
import { HINTS } from "./hints";
import { BTN, BTN_PRIMARY, STATE_LABEL, ago } from "./shared";
import StateDot from "./StateDot";

/**
 * Claude's proposal for the active set. Claude proposes; the learner decides.
 * Keyed by proposal timestamp by the parent, so a new proposal resets the choice.
 */
export default function PrunePanel({
  headerAction,
  proposal,
  nudge,
  now,
  onOpenConcept,
}: {
  proposal: PruneProposal;
  nudge: Nudge;
  now: number;
  onOpenConcept: (id: string) => void;
  /** Optional control shown in the header row (the dock's "Expand"). */
  headerAction?: ReactNode;
}) {
  const { state, actions } = useLearner();
  const { size } = state.activeSet;
  const exists = (cid: string) => !!state.concepts[cid];
  const name = (cid: string) => state.concepts[cid]?.name ?? cid;

  const recIds = proposal.recommended.map((r) => r.conceptId).filter(exists);
  const [showAll, setShowAll] = useState(false);
  const [selected, setSelected] = useState<string[]>(() => Array.from(new Set(recIds)).slice(0, size));

  const options = Array.from(
    new Set([
      ...recIds,
      ...state.activeSet.conceptIds,
      ...proposal.swaps.flatMap((s) => [s.in, s.out]),
    ]),
  ).filter(exists);

  const atCap = selected.length >= size;
  const toggle = (cid: string) =>
    setSelected((cur) => (cur.includes(cid) ? cur.filter((x) => x !== cid) : cur.length >= size ? cur : [...cur, cid]));

  const quiet = proposal.goneQuiet.filter(exists);
  const reasoningFor = new Map(proposal.recommended.map((r) => [r.conceptId, r.reasoning]));

  return (
    <section data-testid="prune-panel" className="border-t border-rule bg-panel-2 px-4 py-3">
      <div className="flex items-center gap-3">
        <h3 className="flex flex-1 items-center gap-1.5 text-xs font-medium text-ink">
          Proposed active set
          <Hint text={HINTS.proposal} label="About this proposal" />
        </h3>
        <span className="text-xs text-ink-2">{ago(proposal.ts, now)}</span>
        {headerAction}
      </div>
      {proposal.summary ? (
        <div className="mt-1">
          <p className={`text-sm text-ink ${showAll ? "" : "line-clamp-3"}`}>{proposal.summary}</p>
          {proposal.summary.length > 220 ? (
            <button
              type="button"
              className="text-xs text-ink-2 underline-offset-2 hover:text-ink hover:underline"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
            >
              {showAll ? "Less" : "More"}
            </button>
          ) : null}
        </div>
      ) : null}

      {proposal.swaps.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {proposal.swaps.map((s) => (
            <li key={`${s.out}-${s.in}`} className="text-sm text-ink">
              <span className="text-ink-2">Swap </span>
              <span className="font-medium">{name(s.out)}</span>
              <span className="text-ink-2"> → </span>
              <span className="font-medium">{name(s.in)}</span>
              <span className="text-ink-2">: {s.reasoning}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <fieldset className="mt-3">
        <legend className="text-xs text-ink-2">
          Choose up to {size} · {selected.length} selected
        </legend>
        <ul className="mt-1 space-y-0.5">
          {options.map((cid) => {
            const c = state.concepts[cid];
            const checked = selected.includes(cid);
            const disabled = !checked && atCap;
            const reasoning = reasoningFor.get(cid);
            const current = state.activeSet.conceptIds.includes(cid);
            return (
              <li key={cid}>
                <label
                  className={`flex items-start gap-2 rounded-md px-2 py-1.5 ${
                    disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-panel"
                  }`}
                >
                  <input
                    type="checkbox"
                    data-testid={`prune-option-${cid}`}
                    className="mt-1 accent-accent"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(cid)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <StateDot state={c.state} />
                      <span className="text-sm text-ink">{c.name}</span>
                      <span className="text-xs text-ink-2">
                        {[reasoning ? "recommended" : null, current ? "active now" : null, c.pinned ? "pinned" : null]
                          .filter(Boolean)
                          .join(" · ") || STATE_LABEL[c.state].toLowerCase()}
                      </span>
                    </span>
                    {reasoning ? <span className="mt-0.5 block text-xs text-ink-2">{reasoning}</span> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      {quiet.length > 0 ? (
        <p className="mt-2 text-xs text-ink-2">
          Gone quiet:{" "}
          {quiet.map((cid, i) => (
            <span key={cid}>
              {i > 0 ? ", " : ""}
              <button
                type="button"
                className="text-ink underline-offset-2 hover:underline"
                onClick={() => onOpenConcept(cid)}
              >
                {name(cid)}
              </button>
            </span>
          ))}
          . No practice or recognition in over ten days. Flagged, not removed.
        </p>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          data-testid="prune-accept"
          className={BTN_PRIMARY}
          disabled={selected.length === 0}
          onClick={() => actions.chooseActiveSet(options.filter((cid) => selected.includes(cid)))}
        >
          Accept
        </button>
        <button type="button" data-testid="prune-keep" className={BTN} onClick={() => actions.dismissNudge(nudge.id)}>
          Keep current
        </button>
        {atCap ? <span className="text-xs text-ink-2">The set holds {size}. Uncheck one to swap.</span> : null}
      </div>
    </section>
  );
}
