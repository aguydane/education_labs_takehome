"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLearner } from "@/lib/learner-context";
import Hint from "@/components/ui/Hint";
import { pendingNudges } from "@/lib/pipeline/triggers";
import ActiveSetStrip from "./ActiveSetStrip";
import CalendarStrip from "./CalendarStrip";
import { useNow } from "./clock";
import ConceptDetail from "./ConceptDetail";
import EdgeDetail from "./EdgeDetail";
import { useRecognitionFlashes } from "./flashes";
import GraphCanvas from "./GraphCanvas";
import { HINTS } from "./hints";
import { ChevronRight } from "./icons";
import Inbox from "./Inbox";
import { LayoutStore } from "./layout";
import Legend from "./Legend";
import PrunePanel from "./PrunePanel";
import Rail from "./Rail";
import { ICON_BTN, edgeKey, graphFor } from "./shared";

type Selection = { type: "node"; id: string } | { type: "edge"; key: string } | null;

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

  // One selection at a time: a node or an edge.
  const [selection, setSelection] = useState<Selection>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selectNode = useCallback((id: string | null) => setSelection(id ? { type: "node", id } : null), []);
  const selectEdge = useCallback((key: string) => setSelection({ type: "edge", key }), []);
  const clearSelection = useCallback(() => setSelection(null), []);
  const [played, setPlayed] = useState<Readonly<Record<string, true>>>({});
  const flashes = useRecognitionFlashes(state, now);
  const markPlayed = useCallback(
    (key: string) => setPlayed((p) => (p[key] ? p : { ...p, [key]: true })),
    [],
  );

  const { concepts, activeSet } = state;
  const minute = Math.floor(now / 60_000);
  const graph = useMemo(() => graphFor(concepts, activeSet, minute), [concepts, activeSet, minute]);
  // Derived, so a deleted concept or a removed link simply drops the selection.
  const selected = selection?.type === "node" && concepts[selection.id] ? selection.id : null;
  const selectedEdge =
    selection?.type === "edge" ? (graph.edges.find((e) => edgeKey(e) === selection.key) ?? null) : null;

  const { toggleGraph } = actions;
  const openFromRail = useCallback(
    (id: string) => {
      setSelection({ type: "node", id });
      toggleGraph();
    },
    [toggleGraph],
  );

  // Escape clears the selection. Listened for on the window because clicking an
  // edge leaves focus on the body; keys meant for the chat or an input are left alone.
  const hasSelection = selection !== null;
  useEffect(() => {
    if (!hasSelection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target;
      if (t === document.body || (t instanceof Node && panelRef.current?.contains(t))) clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSelection, clearSelection]);

  if (state.ui.graphCollapsed) {
    return <Rail flashes={flashes} now={now} onOpenConcept={openFromRail} />;
  }

  const pruneNudge = pendingNudges(state).find((n) => n.kind === "prune-proposal");
  const proposal = activeSet.lastProposal;
  const pending = proposal && pruneNudge ? proposal : undefined;
  const total = Object.keys(concepts).length;

  return (
    <div ref={panelRef} data-testid="graph-panel" className="flex h-full flex-col overflow-y-auto">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-rule pl-4 pr-2">
        <h2 className="text-sm font-semibold text-ink">Your map</h2>
        <Hint text={HINTS.map} label="About your map" />
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

      <GraphCanvas
        graph={graph}
        layout={layout}
        selectedId={selected}
        onSelect={selectNode}
        selectedEdgeKey={selectedEdge ? edgeKey(selectedEdge) : null}
        onSelectEdge={selectEdge}
        proposal={pending}
        flashes={flashes}
        played={played}
        onFlashDone={markPlayed}
        now={now}
      />
      <Legend />

      {/* The dock: what's waiting, the active set, a pending proposal, and the selected concept or link.
          Sized to its content up to a cap and scrolling inside, so the map keeps the room. */}
      <div className="relative max-h-[33%] shrink-0 overflow-y-auto border-t border-rule">
        <Inbox onOpenConcept={selectNode} />
        <ActiveSetStrip selectedId={selected} onOpenConcept={selectNode} />
        {pending && pruneNudge ? (
          <PrunePanel
            key={pending.ts}
            proposal={pending}
            nudge={pruneNudge}
            now={now}
            onOpenConcept={selectNode}
          />
        ) : null}
        {selected ? (
          <ConceptDetail key={selected} conceptId={selected} onSelectConcept={selectNode} onClose={clearSelection} />
        ) : null}
        {selectedEdge ? (
          <EdgeDetail
            key={edgeKey(selectedEdge)}
            edge={selectedEdge}
            onSelectConcept={selectNode}
            onClose={clearSelection}
          />
        ) : null}
      </div>
    </div>
  );
}
