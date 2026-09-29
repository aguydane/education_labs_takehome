"use client";

import { useState, type ReactNode } from "react";
import { useLearner } from "@/lib/learner-context";
import Hint from "@/components/ui/Hint";
import { relationsOf } from "@/lib/pipeline/relations";
import { CloseIcon } from "./icons";
import { HINTS } from "./hints";
import StateDot from "./StateDot";
import { BTN, exchangesLabel } from "./shared";

type LinkKind = "related" | "needs";

/**
 * A concept's edges, readable as sentences, plus the control for drawing a
 * new one. Harvest links can't be removed here (they are evidence, not
 * opinion); links the learner drew can.
 */
export default function Connections({
  conceptId,
  onSelectConcept,
}: {
  conceptId: string;
  onSelectConcept: (id: string) => void;
}) {
  const { state, actions } = useLearner();
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<LinkKind>("related");

  const rows = relationsOf(state, conceptId);
  const candidates = Object.values(state.concepts)
    .filter((c) => c.id !== conceptId && c.state !== "dormant")
    .sort((x, y) => x.name.localeCompare(y.name));

  const add = () => {
    if (!target || !state.concepts[target]) return;
    // "This needs it first": the other concept is the prerequisite (the edge's source).
    if (kind === "needs") actions.addRelation(target, conceptId, "prereq");
    else actions.addRelation(conceptId, target, "related");
    setTarget("");
  };

  const neighbour = (id: string, label: string) => (
    <button
      type="button"
      onClick={() => onSelectConcept(id)}
      className="inline-flex min-w-0 items-center gap-1.5 font-medium text-ink underline-offset-2 hover:underline"
    >
      <StateDot state={state.concepts[id].state} />
      <span className="truncate">{label}</span>
    </button>
  );

  return (
    <section data-testid="detail-connections">
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
        <span>
          Connections<span className="font-normal"> · {rows.length}</span>
        </span>
        <Hint text={HINTS.connections} label="About connections" />
      </h4>

      {rows.length === 0 ? (
        <p className="mt-1.5 text-xs text-ink-2">Not linked to anything yet.</p>
      ) : (
        <ul className="mt-1.5 space-y-1">
          {rows.map((r) => {
            const drawn = r.source === "learner";
            const who = drawn ? "you drew this" : "from Helm";
            let body: ReactNode;
            if (r.kind === "cooccur") {
              body = (
                <>
                  {neighbour(r.other.id, r.other.name)}
                  <span className="shrink-0 text-xs text-ink-2">came up together · {exchangesLabel(r.weight)}</span>
                </>
              );
            } else if (r.kind === "related") {
              body = (
                <>
                  {neighbour(r.other.id, r.other.name)}
                  <span className="shrink-0 text-xs text-ink-2">related · {who}</span>
                </>
              );
            } else {
              // direction "out": this concept holds the edge, so it is the prerequisite.
              body = (
                <>
                  <span className="shrink-0 text-xs text-ink-2">{r.direction === "out" ? "prerequisite for" : "needs"}</span>
                  {neighbour(r.other.id, r.other.name)}
                  <span className="shrink-0 text-xs text-ink-2">
                    {r.direction === "out" ? "" : "first "}· {who}
                  </span>
                </>
              );
            }
            return (
              <li key={`${r.other.id}-${r.kind}-${r.direction}`} className="flex items-center gap-2 text-sm">
                <span className="flex min-w-0 flex-1 items-baseline gap-1.5">{body}</span>
                {drawn ? (
                  <button
                    type="button"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-ink-2 hover:bg-panel-2 hover:text-ink"
                    aria-label={`Remove link to ${r.other.name}`}
                    title="Remove this link"
                    onClick={() => actions.removeRelation(conceptId, r.other.id, r.kind)}
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <div data-testid="detail-link" className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
        <label className="sr-only" htmlFor={`link-target-${conceptId}`}>
          Link to another concept
        </label>
        <select
          id={`link-target-${conceptId}`}
          data-testid="detail-link-target"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="min-w-0 max-w-full flex-1 rounded-md border border-rule bg-panel px-2 py-1 text-xs text-ink"
        >
          <option value="" disabled>
            Link to another concept…
          </option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label className="sr-only" htmlFor={`link-kind-${conceptId}`}>
          Kind of link
        </label>
        <select
          id={`link-kind-${conceptId}`}
          data-testid="detail-link-kind"
          value={kind}
          onChange={(e) => setKind(e.target.value === "needs" ? "needs" : "related")}
          className="rounded-md border border-rule bg-panel px-2 py-1 text-xs text-ink"
        >
          <option value="related">related</option>
          <option value="needs">this needs it first</option>
        </select>
        <button type="button" data-testid="detail-link-add" className={BTN} disabled={!target} onClick={add}>
          Add
        </button>
      </div>
    </section>
  );
}
