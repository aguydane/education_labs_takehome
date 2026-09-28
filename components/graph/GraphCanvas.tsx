"use client";

import {
  memo,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { Graph, GraphNode } from "@/lib/pipeline/graph";
import type { PruneProposal } from "@/lib/types";
import type { Flashes } from "./flashes";
import { RECENT_MS } from "./flashes";
import styles from "./graph.module.css";
import type { LayoutEdge, LayoutNode, LayoutStore } from "./layout";
import { placeLabels } from "./labels";
import { STATE_LABEL, stateVar, truncate } from "./shared";

type Props = {
  graph: Graph;
  layout: LayoutStore;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** The pending proposal, if any: drives the dashed "recommended" ring and hover reasoning. */
  proposal?: PruneProposal;
  flashes: Flashes;
  played: Readonly<Record<string, true>>;
  onFlashDone: (key: string) => void;
  now: number;
};

type Drag = {
  id: string;
  pointerId: number;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
  moved: boolean;
};

const LABEL_CHARS = 18;
const TOOLTIP_W = 220;

const STATE_RANK: Record<GraphNode["state"], number> = {
  dormant: 0,
  delegated: 1,
  noticed: 2,
  durable: 3,
  chosen: 4,
  practicing: 5,
};

function radiusOf(n: GraphNode): number {
  return 7 + 13 * Math.max(0, Math.min(1, n.weight));
}

function GraphCanvas({
  graph,
  layout,
  selectedId,
  onSelect,
  proposal,
  flashes,
  played,
  onFlashDone,
  now,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const suppressClickRef = useRef(false);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const arrowId = `graph-arrow-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

  const layoutNodes = useMemo<LayoutNode[]>(
    () => graph.nodes.map((n) => ({ id: n.id, r: radiusOf(n) })),
    [graph.nodes],
  );

  // Edge weights normalized per kind: cooccur weights are counts, the others are 0–1.
  const edges = useMemo(() => {
    const max: Partial<Record<string, number>> = {};
    for (const e of graph.edges) max[e.kind] = Math.max(max[e.kind] ?? 0, e.weight);
    return graph.edges.map((e) => {
      const m = max[e.kind] ?? 0;
      return { ...e, w: m > 0 ? Math.max(0, e.weight) / m : 0.5 };
    });
  }, [graph.edges]);

  const layoutEdges = useMemo<LayoutEdge[]>(
    () => edges.map((e) => ({ source: e.source, target: e.target, w: e.w })),
    [edges],
  );

  // Keep the layout engine in sync with the graph. It re-lays out only when the id set changes.
  useLayoutEffect(() => {
    layout.setGraph(layoutNodes, layoutEdges);
  }, [layout, layoutNodes, layoutEdges]);

  // Measure before paint, then follow container resizes.
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    layout.setSize(rect.width, rect.height);
    const ro = new ResizeObserver((entries) => {
      const r = entries[0]?.contentRect;
      if (r) layout.setSize(r.width, r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout]);

  const snap = useSyncExternalStore(layout.subscribe, layout.getSnapshot, layout.getSnapshot);

  const ordered = useMemo(
    () =>
      [...graph.nodes].sort(
        (a, b) =>
          Number(a.active) - Number(b.active) ||
          STATE_RANK[a.state] - STATE_RANK[b.state] ||
          a.id.localeCompare(b.id),
      ),
    [graph.nodes],
  );

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const reasoning = useMemo(
    () => new Map((proposal?.recommended ?? []).map((r) => [r.conceptId, r.reasoning])),
    [proposal],
  );

  const focusId = dragId ? null : (hoverId ?? selectedId);

  const { w, h, pos } = snap;
  const geometry = useMemo(() => {
    const placedNodes = ordered.flatMap((n) => {
      const p = pos[n.id];
      return p ? [{ n, p, r: radiusOf(n) }] : [];
    });
    const spots = placeLabels(
      placedNodes.map(({ n, p, r }) => {
        const selected = n.id === selectedId;
        const recommended = n.recommended && !!proposal;
        // Labels clear the node's outermost ring, not just its fill.
        const outer = r + (n.active ? 4.5 : 0) + (recommended ? 4.5 : 0) + (selected ? 4.5 : 0);
        return {
          id: n.id,
          x: p.x,
          y: p.y,
          r: outer,
          text: n.state === "dormant" ? "" : truncate(n.name, LABEL_CHARS),
          priority: selected ? 0 : n.active ? 1 : recommended ? 2 : n.pinned ? 3 : 4 + (1 - n.weight),
          force: selected || n.active,
        };
      }),
      w,
      h,
    );
    return placedNodes.map(({ n, p, r }) => {
      const spot = spots.get(n.id);
      return { n, p, r, label: spot ? truncate(n.name, LABEL_CHARS) : "", spot };
    });
  }, [ordered, pos, w, h, selectedId, proposal]);

  // ---- Pointer handling ---------------------------------------------------

  const toLocal = (e: PointerEvent<Element>): { x: number; y: number } | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: PointerEvent<SVGElement>, id: string) => {
    if (e.button !== 0) return;
    const p = toLocal(e);
    const at = snap.pos[id];
    if (!p || !at) return;
    dragRef.current = { id, pointerId: e.pointerId, sx: p.x, sy: p.y, ox: at.x - p.x, oy: at.y - p.y, moved: false };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // capture is a nicety; dragging still works without it
    }
  };

  const onPointerMove = (e: PointerEvent<SVGElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const p = toLocal(e);
    if (!p) return;
    if (!d.moved) {
      if (Math.hypot(p.x - d.sx, p.y - d.sy) < 3) return;
      d.moved = true;
      setDragId(d.id);
    }
    layout.move(d.id, p.x + d.ox, p.y + d.oy);
  };

  const endDrag = (e: PointerEvent<SVGElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    suppressClickRef.current = d.moved;
    dragRef.current = null;
    setDragId(null);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // already released
    }
  };

  const onNodeClick = (id: string) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onSelect(id);
  };

  const onNodeKey = (e: KeyboardEvent<SVGGElement>, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelect(id);
    }
  };

  // ---- Render ---------------------------------------------------------------

  const hovered = !dragId && hoverId ? byId.get(hoverId) : undefined;
  const hoverPos = hovered ? pos[hovered.id] : undefined;

  return (
    <div
      ref={containerRef}
      data-testid="graph-canvas"
      className="relative min-h-[320px] flex-1 shrink-0 overflow-hidden"
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full select-none"
        role="group"
        aria-label="Concept map"
      >
        <defs>
          <marker
            id={arrowId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,1.5 L9,5 L0,8.5 z" fill="var(--ink-2)" />
          </marker>
        </defs>

        <rect width="100%" height="100%" fill="transparent" onClick={() => onSelect(null)} />

        <g aria-hidden>
          {edges.map((e) => {
            const a = pos[e.source];
            const b = pos[e.target];
            const na = byId.get(e.source);
            const nb = byId.get(e.target);
            if (!a || !b || !na || !nb) return null;
            const touches = focusId !== null && (e.source === focusId || e.target === focusId);
            const faded = na.state === "dormant" || nb.state === "dormant";
            let opacity = 0.14 + 0.46 * e.w;
            if (faded) opacity *= 0.5;
            if (touches) opacity = Math.max(opacity, 0.75);
            // Stop prereq arrows at the target's edge.
            let x2 = b.x;
            let y2 = b.y;
            if (e.kind === "prereq") {
              const dx = b.x - a.x;
              const dy = b.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              const cut = radiusOf(nb) + 3;
              x2 = b.x - (dx / len) * cut;
              y2 = b.y - (dy / len) * cut;
            }
            return (
              <line
                key={`${e.source}|${e.target}|${e.kind}`}
                x1={a.x}
                y1={a.y}
                x2={x2}
                y2={y2}
                stroke="var(--ink-2)"
                strokeWidth={touches ? 1.4 : 1}
                strokeDasharray={e.kind === "related" ? "4 3" : undefined}
                markerEnd={e.kind === "prereq" ? `url(#${arrowId})` : undefined}
                opacity={opacity}
              />
            );
          })}
        </g>

        {/* Labels sit under every node, so a label can never cover another node's circle. */}
        <g>
          {geometry.map(({ n, label, spot }) =>
            label && spot ? (
              <text
                key={n.id}
                x={spot.x}
                y={spot.y}
                textAnchor={spot.anchor}
                className="text-xs"
                fill={n.active || n.id === selectedId ? "var(--ink)" : "var(--ink-2)"}
                fontWeight={n.active || n.id === selectedId ? 500 : 400}
                opacity={n.state === "delegated" ? 0.45 : 1}
                style={{ cursor: dragId === n.id ? "grabbing" : "pointer", touchAction: "none" }}
                onPointerDown={(e) => onPointerDown(e, n.id)}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerEnter={() => setHoverId(n.id)}
                onPointerLeave={() => setHoverId((cur) => (cur === n.id ? null : cur))}
                onClick={() => onNodeClick(n.id)}
              >
                {label}
              </text>
            ) : null,
          )}
        </g>

        <g>
          {geometry.map(({ n, r, p }) => {
            const selected = n.id === selectedId;
            const recommended = n.recommended && !!proposal;
            const dormant = n.state === "dormant";
            const delegated = n.state === "delegated";

            // Rings, inside out: active, recommended, selected, focus.
            let outer = r;
            const activeR = r + 3;
            if (n.active) outer = r + 4.5;
            const recR = outer + 3.5;
            if (recommended) outer = recR + 1;
            const selR = outer + 3.5;
            if (selected) outer = selR + 1;
            const focusR = outer + 3;

            const flash = flashes[n.id];
            const flashKey = flash ? `${n.id}:${flash.n}` : "";
            const showFlash = !!flash && !played[flashKey] && now - flash.at < RECENT_MS;

            return (
              <g
                key={n.id}
                data-testid={`graph-node-${n.id}`}
                data-state={n.state}
                data-active={n.active ? "true" : "false"}
                data-selected={selected ? "true" : "false"}
                transform={`translate(${p.x},${p.y})`}
                opacity={dormant ? 0.3 : delegated ? 0.45 : 1}
                role="button"
                tabIndex={0}
                aria-label={`${n.name}, ${STATE_LABEL[n.state].toLowerCase()}${n.active ? ", active" : ""}`}
                aria-pressed={selected}
                className={styles.node}
                style={{ cursor: dragId === n.id ? "grabbing" : "pointer", touchAction: "none" }}
                onPointerDown={(e) => onPointerDown(e, n.id)}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerEnter={() => setHoverId(n.id)}
                onPointerLeave={() => setHoverId((cur) => (cur === n.id ? null : cur))}
                onFocus={() => setHoverId(n.id)}
                onBlur={() => setHoverId((cur) => (cur === n.id ? null : cur))}
                onClick={() => onNodeClick(n.id)}
                onKeyDown={(e) => onNodeKey(e, n.id)}
              >
                {/* A forgiving hit target for small nodes. */}
                <circle r={Math.max(r + 3, 11)} fill="transparent" />
                <circle className={styles.focusRing} r={focusR} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
                {selected ? <circle r={selR} fill="none" stroke="var(--ink)" strokeWidth={1.5} /> : null}
                {recommended ? (
                  <circle r={recR} fill="none" stroke="var(--accent)" strokeWidth={1.25} strokeDasharray="3 2.5" />
                ) : null}
                {n.active ? <circle r={activeR} fill="none" stroke="var(--accent)" strokeWidth={2.5} /> : null}
                <circle
                  r={r}
                  fill={stateVar(n.state)}
                  stroke={n.state === "noticed" && !n.active ? "var(--ink-2)" : "var(--panel)"}
                  strokeWidth={n.active ? 1.5 : 1}
                  strokeOpacity={n.state === "noticed" && !n.active ? 0.6 : 1}
                />
                {n.pinned ? (
                  <circle cx={r * 0.72} cy={-r * 0.72} r={2.6} fill="var(--ink)" stroke="var(--panel)" strokeWidth={1} />
                ) : null}
                {delegated ? (
                  <line
                    x1={-r * 0.55}
                    y1={r * 0.55}
                    x2={r * 0.55}
                    y2={-r * 0.55}
                    stroke="var(--ink)"
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                ) : null}
                {showFlash ? (
                  <circle
                    key={flashKey}
                    className={styles.flash}
                    r={r + 2}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    vectorEffect="non-scaling-stroke"
                    onAnimationEnd={() => onFlashDone(flashKey)}
                  />
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>

      {graph.nodes.length === 0 ? (
        <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-sm text-ink-2">
          Concepts from your work will appear here as you go.
        </div>
      ) : null}

      {hovered && hoverPos ? (
        <NodeTooltip
          node={hovered}
          x={hoverPos.x}
          y={hoverPos.y}
          r={radiusOf(hovered)}
          w={w}
          h={h}
          reasoning={hovered.recommended ? reasoning.get(hovered.id) : undefined}
        />
      ) : null}
    </div>
  );
}

function NodeTooltip({
  node,
  x,
  y,
  r,
  w,
  h,
  reasoning,
}: {
  node: GraphNode;
  x: number;
  y: number;
  r: number;
  w: number;
  h: number;
  reasoning?: string;
}) {
  const right = x + r + 12 + TOOLTIP_W <= w - 4;
  const left = right ? x + r + 12 : Math.max(4, x - r - 12 - TOOLTIP_W);
  const top = Math.max(4, Math.min(y - 14, h - (reasoning ? 116 : 60)));
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-10 rounded-md border border-rule bg-panel px-2.5 py-1.5 text-xs shadow-sm"
      style={{ left, top, maxWidth: TOOLTIP_W }}
    >
      <div className="font-medium text-ink">{node.name}</div>
      <div className="mt-0.5 flex items-center gap-1.5 text-ink-2">
        <span className="inline-block h-2 w-2 rounded-full" style={{ background: stateVar(node.state) }} />
        {STATE_LABEL[node.state]}
        <span aria-hidden>·</span>
        confidence {node.confidence}
        {node.pinned ? (
          <>
            <span aria-hidden>·</span>pinned
          </>
        ) : null}
      </div>
      {reasoning ? <p className="mt-1 line-clamp-3 text-ink-2">{reasoning}</p> : null}
    </div>
  );
}

export default memo(GraphCanvas);
