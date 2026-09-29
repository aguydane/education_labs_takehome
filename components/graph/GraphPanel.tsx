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
import { ChevronRight, ColumnIcon, DockBelowIcon } from "./icons";
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

  // Switching layouts reorders the dock without remounting it, so bring the
  // selected card back into view: at the top of the column, or scrolled to under the map.
  const focusedNow = !!state.ui.dockFocused;
  const dockBodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const body = dockBodyRef.current;
    if (!body) return;
    const card = body.querySelector<HTMLElement>('[data-testid="concept-detail"], [data-testid="edge-detail"]');
    body.scrollTo({ top: focusedNow || !card ? 0 : card.offsetTop });
  }, [focusedNow]);

  if (state.ui.graphCollapsed) {
    return <Rail flashes={flashes} now={now} onOpenConcept={openFromRail} />;
  }

  const pruneNudge = pendingNudges(state).find((n) => n.kind === "prune-proposal");
  const proposal = activeSet.lastProposal;
  const pending = proposal && pruneNudge ? proposal : undefined;
  const total = Object.keys(concepts).length;

  const focused = focusedNow;
  const { setDockFocused } = actions;

  // Exactly one "Expand" control, on the card that heads the dock.
  const expand = focused ? null : (
    <button
      type="button"
      data-testid="dock-focus"
      onClick={() => setDockFocused(true)}
      title="Open this as a column beside the map"
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink"
    >
      <ColumnIcon className="h-3.5 w-3.5" />
      Expand
    </button>
  );
  const expandOn: "node" | "edge" | "prune" | null = selected
    ? "node"
    : selectedEdge
      ? "edge"
      : pending
        ? "prune"
        : null;

  // Dock children, keyed so they keep their state when the order changes between layouts.
  const inbox = <Inbox key="inbox" onOpenConcept={selectNode} />;
  const activeStrip = <ActiveSetStrip key="active" selectedId={selected} onOpenConcept={selectNode} />;
  const prunePanel =
    pending && pruneNudge ? (
      <PrunePanel
        key={`prune-${pending.ts}`}
        proposal={pending}
        nudge={pruneNudge}
        now={now}
        onOpenConcept={selectNode}
        headerAction={expandOn === "prune" ? expand : null}
      />
    ) : null;
  const selectionCard = selected ? (
    <ConceptDetail
      key={`node-${selected}`}
      conceptId={selected}
      onSelectConcept={selectNode}
      onClose={clearSelection}
      headerAction={expandOn === "node" ? expand : null}
    />
  ) : selectedEdge ? (
    <EdgeDetail
      key={`edge-${edgeKey(selectedEdge)}`}
      edge={selectedEdge}
      onSelectConcept={selectNode}
      onClose={clearSelection}
      headerAction={expandOn === "edge" ? expand : null}
    />
  ) : null;
  const placeholder =
    focused && !selectionCard && !prunePanel ? (
      <p key="placeholder" className="px-4 py-10 text-center text-sm text-ink-2">
        Select an idea or a line on the map.
      </p>
    ) : null;

  // Under the map: the small things first, the card last. As a column: the card first.
  const dockChildren = focused
    ? [selectionCard, prunePanel, placeholder, inbox, activeStrip]
    : [inbox, activeStrip, prunePanel, selectionCard];

  // One tree for both layouts (only classes and child order change), so nothing
  // remounts when the learner switches: checkbox choices and scroll positions survive.
  return (
    <div
      ref={panelRef}
      data-testid="graph-panel"
      data-dock={focused ? "column" : "below"}
      className={`flex h-full ${focused ? "flex-row" : "flex-col overflow-y-auto"}`}
    >
      <div className={`flex flex-col ${focused ? "min-w-0 flex-1 overflow-y-auto" : "flex-1"}`}>
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
      </div>

      {/* The dock: the selected concept or link, a pending proposal, what's waiting, and the active set.
          Below the map it is sized to its content up to a cap; as a column it takes the full height. */}
      <div
        data-testid="graph-dock"
        className={`flex flex-col ${
          focused ? "order-first h-full w-[400px] shrink-0 border-r border-rule" : "max-h-[33%] shrink-0 border-t border-rule"
        }`}
      >
        {focused ? (
          <div className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-rule pl-4 pr-2">
            <span className="text-xs text-ink-2">Details</span>
            <button
              type="button"
              data-testid="dock-unfocus"
              onClick={() => setDockFocused(false)}
              title="Put these details back under the map"
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink"
            >
              <DockBelowIcon className="h-3.5 w-3.5" />
              Dock below map
            </button>
          </div>
        ) : null}
        <div ref={dockBodyRef} className="relative min-h-0 flex-1 overflow-y-auto">
          {dockChildren}
        </div>
      </div>
    </div>
  );
}
