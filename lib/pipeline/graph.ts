import type { ConceptState, Confidence, LearnerState } from "@/lib/types";
import { nowIso } from "@/lib/util";
import { effectiveSignal } from "./scoring";

export type GraphNode = {
  id: string;
  name: string;
  state: ConceptState;
  confidence: Confidence;
  /** 0–1, from effective signal. Drives radius. */
  weight: number;
  active: boolean;
  pinned: boolean;
  /** In the latest prune proposal. */
  recommended: boolean;
  timesSeen: number;
};

export type GraphEdge = {
  source: string;
  target: string;
  kind: "prereq" | "related" | "cooccur";
  weight: number;
};

export type Graph = { nodes: GraphNode[]; edges: GraphEdge[] };

export function deriveGraph(state: LearnerState, now = nowIso()): Graph {
  const concepts = Object.values(state.concepts);
  const maxSignal = Math.max(0.01, ...concepts.map((c) => effectiveSignal(c, now)));
  const active = new Set(state.activeSet.conceptIds);
  const recommended = new Set(state.activeSet.lastProposal?.recommended.map((r) => r.conceptId) ?? []);

  const nodes: GraphNode[] = concepts.map((c) => ({
    id: c.id,
    name: c.name,
    state: c.state,
    confidence: c.confidence,
    weight: Math.min(1, effectiveSignal(c, now) / maxSignal),
    active: active.has(c.id),
    pinned: c.pinned,
    recommended: recommended.has(c.id),
    timesSeen: c.timesSeen,
  }));

  const seen = new Set<string>();
  const edges: GraphEdge[] = [];
  for (const c of concepts) {
    for (const r of c.relations) {
      if (!state.concepts[r.to]) continue;
      const key = [c.id, r.to].sort().join("|") + "|" + r.kind;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ source: c.id, target: r.to, kind: r.kind, weight: r.weight });
    }
  }
  return { nodes, edges };
}
