/**
 * Force layout for the concept map, kept outside React.
 *
 * The simulation runs to completion synchronously and the result is published
 * as an immutable snapshot that components read with useSyncExternalStore.
 * State updates (new signal, a recognition, a pin) never re-layout; only a
 * change in the set of node ids or in the container size does. Dragged nodes
 * stay where the learner put them across later layouts.
 */

import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type Force,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";

export type Pos = { x: number; y: number };
export type LayoutSnapshot = { w: number; h: number; pos: Readonly<Record<string, Pos>> };
export type LayoutNode = { id: string; r: number };
/** `w` is the edge weight normalized to 0–1. */
export type LayoutEdge = { source: string; target: string; w: number };

type SimNode = SimulationNodeDatum & { id: string; r: number };
type SimLink = SimulationLinkDatum<SimNode> & { w: number };

const PAD = 14;
const MIN_SIDE = 160;
const SETTLE_MS = 160;
const GOLDEN = 2.399963;

function clamp(v: number, lo: number, hi: number): number {
  if (hi < lo) return (lo + hi) / 2;
  return Math.min(hi, Math.max(lo, v));
}

function endRadius(e: SimNode | string | number): number {
  return typeof e === "object" ? e.r : 10;
}

/** Keeps nodes inside the box by trimming velocity before positions integrate. */
function boundsForce(w: number, h: number): Force<SimNode, SimLink> {
  let nodes: SimNode[] = [];
  const force = () => {
    for (const n of nodes) {
      if (n.fx != null) continue;
      const lo = n.r + PAD;
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      const vx = n.vx ?? 0;
      const vy = n.vy ?? 0;
      if (x + vx < lo) n.vx = lo - x;
      else if (x + vx > w - lo) n.vx = w - lo - x;
      if (y + vy < lo) n.vy = lo - y;
      else if (y + vy > h - lo) n.vy = h - lo - y;
    }
  };
  force.initialize = (ns: SimNode[]) => {
    nodes = ns;
  };
  return force;
}

export class LayoutStore {
  private snapshot: LayoutSnapshot = { w: 0, h: 0, pos: {} };
  private listeners = new Set<() => void>();
  private nodes: LayoutNode[] = [];
  private edges: LayoutEdge[] = [];
  private idKey = "";
  private w = 0;
  private h = 0;
  private placed = new Set<string>();
  private settleTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  };

  getSnapshot = (): LayoutSnapshot => this.snapshot;

  /** Latest nodes and edges. Lays out again only when the id set changed. */
  setGraph(nodes: LayoutNode[], edges: LayoutEdge[]) {
    this.nodes = nodes;
    this.edges = edges;
    const key = nodes
      .map((n) => n.id)
      .sort()
      .join("|");
    if (key === this.idKey) return;
    this.idKey = key;
    const ids = new Set(nodes.map((n) => n.id));
    for (const pid of this.placed) if (!ids.has(pid)) this.placed.delete(pid);
    this.layout(0.5);
  }

  /** Container size. Scales positions at once; after a shrink, settles once resizing stops. */
  setSize(width: number, height: number) {
    const w = Math.round(width);
    const h = Math.round(height);
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    if (w < MIN_SIDE || h < MIN_SIDE) return;
    const { w: pw, h: ph, pos: prev } = this.snapshot;
    if (pw < MIN_SIDE || ph < MIN_SIDE || Object.keys(prev).length === 0) {
      this.layout(1);
      return;
    }
    const sx = w / pw;
    const sy = h / ph;
    const pos: Record<string, Pos> = {};
    for (const [id, p] of Object.entries(prev)) {
      const r = this.radius(id);
      pos[id] = { x: clamp(p.x * sx, r + PAD, w - r - PAD), y: clamp(p.y * sy, r + PAD, h - r - PAD) };
    }
    this.publish(pos);
    // Growing can't create overlaps, so only a shrink needs the simulation to settle.
    if (sx >= 0.999 && sy >= 0.999) return;
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = setTimeout(() => {
      this.settleTimer = null;
      this.layout(0.25);
    }, SETTLE_MS);
  }

  /** A drag. The node stays put through later layouts. */
  move(id: string, x: number, y: number) {
    if (!this.snapshot.pos[id]) return;
    const r = this.radius(id);
    this.placed.add(id);
    this.publish({
      ...this.snapshot.pos,
      [id]: { x: clamp(x, r + PAD, this.w - r - PAD), y: clamp(y, r + PAD, this.h - r - PAD) },
    });
  }

  dispose() {
    if (this.settleTimer) clearTimeout(this.settleTimer);
    this.settleTimer = null;
  }

  private radius(id: string): number {
    return this.nodes.find((n) => n.id === id)?.r ?? 10;
  }

  private publish(pos: Record<string, Pos>) {
    this.snapshot = { w: this.w, h: this.h, pos };
    for (const l of this.listeners) l();
  }

  private layout(alpha: number) {
    const { w, h } = this;
    if (w < MIN_SIDE || h < MIN_SIDE) return;
    if (this.nodes.length === 0) {
      this.publish({});
      return;
    }
    const prev = this.snapshot.pos;
    const cx = w / 2;
    const cy = h / 2;

    const neighbors = new Map<string, string[]>();
    for (const e of this.edges) {
      neighbors.set(e.source, [...(neighbors.get(e.source) ?? []), e.target]);
      neighbors.set(e.target, [...(neighbors.get(e.target) ?? []), e.source]);
    }

    let known = 0;
    const simNodes: SimNode[] = this.nodes.map((n, i) => {
      const p = prev[n.id];
      const angle = i * GOLDEN;
      if (p) {
        known += 1;
        const node: SimNode = { id: n.id, r: n.r, x: p.x, y: p.y };
        if (this.placed.has(n.id)) {
          node.fx = clamp(p.x, n.r + PAD, w - n.r - PAD);
          node.fy = clamp(p.y, n.r + PAD, h - n.r - PAD);
        }
        return node;
      }
      // New node: start beside a neighbor that already has a place, else near the middle.
      const anchor = (neighbors.get(n.id) ?? []).map((nid) => prev[nid]).find((q): q is Pos => !!q);
      if (anchor) {
        return { id: n.id, r: n.r, x: anchor.x + 28 * Math.cos(angle), y: anchor.y + 28 * Math.sin(angle) };
      }
      const rad = 16 * Math.sqrt(i + 0.5);
      return { id: n.id, r: n.r, x: cx + rad * Math.cos(angle), y: cy + rad * Math.sin(angle) };
    });

    const ids = new Set(simNodes.map((n) => n.id));
    const links: SimLink[] = this.edges
      .filter((e) => ids.has(e.source) && ids.has(e.target) && e.source !== e.target)
      .map((e) => ({ source: e.source, target: e.target, w: e.w }));

    const start = known >= simNodes.length / 2 ? Math.min(1, alpha) : 1;
    const area = w * h;
    const charge = -Math.min(180, Math.max(60, area / (simNodes.length * 40)));

    const sim = forceSimulation<SimNode, SimLink>(simNodes)
      .alpha(start)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance((l) => 26 + endRadius(l.source) + endRadius(l.target) + 70 * (1 - l.w))
          .strength((l) => 0.12 + 0.55 * l.w),
      )
      .force("charge", forceManyBody<SimNode>().strength(charge).distanceMax(Math.max(w, h) * 0.6))
      .force("center", forceCenter<SimNode>(cx, cy).strength(0.4))
      .force("x", forceX<SimNode>(cx).strength(w > h ? 0.04 : 0.08))
      .force("y", forceY<SimNode>(cy).strength(w > h ? 0.08 : 0.04))
      .force(
        "collide",
        forceCollide<SimNode>((d) => d.r + 12).iterations(2),
      )
      .force("bounds", boundsForce(w, h))
      .stop();

    const ticks = Math.ceil(Math.log(sim.alphaMin() / start) / Math.log(1 - sim.alphaDecay()));
    sim.tick(Math.max(1, Math.min(400, ticks)));

    const pos: Record<string, Pos> = {};
    for (const n of simNodes) {
      pos[n.id] = {
        x: clamp(n.x ?? cx, n.r + PAD, w - n.r - PAD),
        y: clamp(n.y ?? cy, n.r + PAD, h - n.r - PAD),
      };
    }
    this.publish(pos);
  }
}
