"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLearner } from "@/lib/learner-context";
import { pendingNudges } from "@/lib/pipeline/triggers";
import ActiveSetStrip from "./ActiveSetStrip";
import CalendarStrip from "./CalendarStrip";
import { useNow } from "./clock";
import ConceptDetail from "./ConceptDetail";
import { useRecognitionFlashes } from "./flashes";
import GraphCanvas from "./GraphCanvas";
import { ChevronRight } from "./icons";
import Inbox from "./Inbox";
import { LayoutStore } from "./layout";
import Legend from "./Legend";
import PrunePanel from "./PrunePanel";
import Rail from "./Rail";
import { ICON_BTN, graphFor } from "./shared";

/**
 * The graph panel: the learner's map of what their work has surfaced, where
 * pruning happens and where recognitions show up. Collapses to a rail so
 * work can have the screen; it never expands on its own.
 */
export default function GraphPanel() {
  const { state, actions } = useLearner();
  const now = useNow();

  // Owned here (always mounted) so positions and drags survive collapse/expand.
  const [layout] = useState(() => new LayoutStore());
  useEffect(() => () => layout.dispose(), [layout]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [played, setPlayed] = useState<Readonly<Record<string, true>>>({});
  const flashes = useRecognitionFlashes(state, now);
  const markPlayed = useCallback(
    (key: string) => setPlayed((p) => (p[key] ? p : { ...p, [key]: true })),
    [],
  );

  const { concepts, activeSet } = state;
  const minute = Math.floor(now / 60_000);
  const graph = useMemo(() => graphFor(concepts, activeSet, minute), [concepts, activeSet, minute]);
  const selected = selectedId && concepts[selectedId] ? selectedId : null;

  const { toggleGraph } = actions;
  const openFromRail = useCallback(
    (id: string) => {
      setSelectedId(id);
      toggleGraph();
    },
    [toggleGraph],
  );

  if (state.ui.graphCollapsed) {
    return <Rail flashes={flashes} now={now} onOpenConcept={openFromRail} />;
  }

  const pruneNudge = pendingNudges(state).find((n) => n.kind === "prune-proposal");
  const proposal = activeSet.lastProposal;
  const pending = proposal && pruneNudge ? proposal : undefined;
  const total = Object.keys(concepts).length;

  return (
    <div
      data-testid="graph-panel"
      className="flex h-full flex-col overflow-y-auto"
      onKeyDown={(e) => {
        if (e.key === "Escape" && selected) setSelectedId(null);
      }}
    >
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-rule pl-4 pr-2">
        <h2 className="text-sm font-semibold text-ink">Your map</h2>
        <span className="text-xs text-ink-2">
          {total} concept{total === 1 ? "" : "s"}
        </span>
        <button
          type="button"
          data-testid="graph-toggle"
          onClick={toggleGraph}
          aria-label="Collapse your map to the rail"
          aria-expanded
          title="Collapse to the rail"
          className={`ml-auto ${ICON_BTN}`}
        >
          <ChevronRight />
        </button>
      </header>

      <CalendarStrip />
      <Inbox onOpenConcept={setSelectedId} />

      <GraphCanvas
        graph={graph}
        layout={layout}
        selectedId={selected}
        onSelect={setSelectedId}
        proposal={pending}
        flashes={flashes}
        played={played}
        onFlashDone={markPlayed}
        now={now}
      />
      <Legend />

      {/* The dock: sized to its content up to a cap, scrolling inside, so the map keeps the room. */}
      <div className="relative max-h-[35%] shrink-0 overflow-y-auto border-t border-rule">
        <ActiveSetStrip selectedId={selected} onOpenConcept={setSelectedId} />
        {pending && pruneNudge ? (
          <PrunePanel
            key={pending.ts}
            proposal={pending}
            nudge={pruneNudge}
            now={now}
            onOpenConcept={setSelectedId}
          />
        ) : null}
        {selected ? <ConceptDetail key={selected} conceptId={selected} onClose={() => setSelectedId(null)} /> : null}
      </div>
    </div>
  );
}
