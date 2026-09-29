"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLearner } from "@/lib/learner-context";
import type { GraphEdge } from "@/lib/pipeline/graph";
import { sharedExchanges } from "@/lib/pipeline/relations";
import styles from "./graph.module.css";
import Hint from "@/components/ui/Hint";
import { findRelation } from "@/lib/pipeline/notes";
import { HINTS } from "./hints";
import { CloseIcon, Spinner } from "./icons";
import Notes from "./Notes";
import ShowInChat from "./ShowInChat";
import StateDot from "./StateDot";
import { BTN, ICON_BTN, edgeKey, edgeKindLine, edgeSentence, exchangesLabel, fmtDate } from "./shared";

const EXCERPT = 90;

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > EXCERPT ? `${flat.slice(0, EXCERPT - 1).trimEnd()}…` : flat;
}

/**
 * What one line on the map is: the two concepts, where the link came from,
 * and the evidence behind it. Harvest links show the exchanges where both
 * concepts came up; links the learner drew can be removed.
 */
export default function EdgeDetail({
  headerAction,
  edge,
  onSelectConcept,
  onClose,
}: {
  edge: GraphEdge;
  onSelectConcept: (id: string) => void;
  onClose: () => void;
  /** Optional control shown in the header row (the dock's "Expand"). */
  headerAction?: ReactNode;
}) {
  const { state, busy, actions } = useLearner();
  const rootRef = useRef<HTMLElement>(null);
  const askedRef = useRef(false);

  const found = findRelation(state, edge.source, edge.target, edge.kind);
  const insight = found?.rel.insight;
  const notes = found?.rel.notes ?? [];
  const hasRelation = !!found;
  const thinking = busy.edges.includes(edgeKey(edge));
  const { explainEdge } = actions;

  // Ask Claude once per opening when the link has no insight yet.
  useEffect(() => {
    if (askedRef.current || insight || !hasRelation) return;
    askedRef.current = true;
    void explainEdge(edge.source, edge.target, edge.kind);
  }, [insight, hasRelation, explainEdge, edge.source, edge.target, edge.kind]);

  // Bring the card into view inside the dock when it opens.
  useEffect(() => {
    const el = rootRef.current;
    const dock = el?.parentElement;
    if (el && dock) dock.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, []);

  const a = state.concepts[edge.source];
  const b = state.concepts[edge.target];
  if (!a || !b) return null;
  const name = (cid: string) => state.concepts[cid]?.name ?? cid;
  const shared = edge.kind === "cooccur" ? [...sharedExchanges(state, a.id, b.id)].reverse() : [];
  const drawn = edge.origin === "learner";

  const conceptButton = (cid: string) => {
    const c = state.concepts[cid];
    return (
      <button
        type="button"
        onClick={() => onSelectConcept(cid)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-md px-1 text-left text-sm font-semibold text-ink underline-offset-2 hover:underline"
      >
        <StateDot state={c.state} />
        <span className="truncate">{c.name}</span>
      </button>
    );
  };

  return (
    <section
      ref={rootRef}
      data-testid="edge-detail"
      aria-label={`Link between ${a.name} and ${b.name}`}
      className={`border-t border-rule bg-panel ${styles.sheet}`}
    >
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-rule bg-panel px-4 pb-2.5 pt-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5">
            {conceptButton(a.id)}
            <span className="text-sm text-ink-2" aria-hidden>
              {edge.kind === "prereq" ? "→" : "·"}
            </span>
            {conceptButton(b.id)}
          </div>
          <p className="mt-1 px-1 text-xs text-ink-2">{edgeKindLine(edge)}</p>
        </div>
        {headerAction}
        <button type="button" data-testid="edge-close" onClick={onClose} aria-label="Close" title="Close" className={ICON_BTN}>
          <CloseIcon />
        </button>
      </header>

      <div className="space-y-4 px-4 py-3">
        <section data-testid="edge-insight">
          <h4 className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
            Why these meet
            <Hint text={HINTS.edgeInsight} label="About this speculation" />
          </h4>
          {thinking ? (
            <p className="mt-1.5 flex items-center gap-2 text-sm text-ink-2">
              <Spinner /> Claude is thinking about this link…
            </p>
          ) : insight ? (
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{insight.text}</p>
          ) : (
            <p className="mt-1.5 text-sm text-ink-2">No read on this link yet.</p>
          )}
          {!thinking ? (
            <p className="mt-1 text-xs text-ink-2">
              {insight ? `${fmtDate(insight.ts)} · ` : ""}
              <button
                type="button"
                data-testid="edge-rethink"
                onClick={() => void explainEdge(edge.source, edge.target, edge.kind)}
                className="underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                {insight ? "Rethink" : "Ask Claude"}
              </button>
            </p>
          ) : null}
        </section>

        <p className="text-sm text-ink">{edgeSentence(edge, name)}.</p>

        {edge.kind === "cooccur" ? (
          <section>
            <h4 className="text-xs font-medium text-ink-2">
              Where they came up together · {exchangesLabel(shared.length)}
            </h4>
            {shared.length === 0 ? (
              <p className="mt-1.5 text-xs text-ink-2">
                The exchanges behind this link are no longer in your history.
              </p>
            ) : (
              <ul className="mt-1.5 space-y-1.5">
                {shared.map((ex) => (
                  <li key={ex.id} className="flex gap-3 text-sm">
                    <span className="w-12 shrink-0 pt-px text-xs text-ink-2 tabular-nums">{fmtDate(ex.ts)}</span>
                    <span className="min-w-0 flex-1 text-ink">&ldquo;{excerpt(ex.user)}&rdquo;</span>
                    <span className="shrink-0 pt-px text-xs">
                      <ShowInChat testId="edge-show-in-chat" onClick={() => actions.revealExchange(ex.id)} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-2">
              Harvest joins two concepts whenever they come up in the same exchange. The line gets thicker each time.
            </p>
          </section>
        ) : null}

        <Notes
          testPrefix="edge"
          notes={notes}
          onAdd={(text) => actions.addRelationNote(edge.source, edge.target, edge.kind, text)}
          onRemove={(noteId) => actions.removeRelationNote(edge.source, edge.target, edge.kind, noteId)}
        />

        {drawn ? (
          <button
            type="button"
            data-testid="edge-remove"
            className={BTN}
            onClick={() => actions.removeRelation(edge.source, edge.target, edge.kind)}
          >
            Remove link
          </button>
        ) : null}
      </div>
    </section>
  );
}
