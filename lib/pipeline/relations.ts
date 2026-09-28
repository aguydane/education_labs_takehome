import type { Concept, Exchange, LearnerState, RelationKind } from "@/lib/types";

/**
 * Edges on the map.
 *
 * Harvest writes "cooccur" edges (see harvest.ts): two concepts that came up
 * in the same exchange are joined, and the weight counts the exchanges. The
 * learner draws "related" and "prereq" edges by hand from the detail pane.
 */

/** The learner draws an edge. Idempotent per (from, to, kind). */
export function addRelation(
  state: LearnerState,
  from: string,
  to: string,
  kind: Exclude<RelationKind, "cooccur">,
): LearnerState {
  const a = state.concepts[from];
  const b = state.concepts[to];
  if (!a || !b || from === to) return state;
  const exists =
    a.relations.some((r) => r.to === to && r.kind === kind) ||
    (kind === "related" && b.relations.some((r) => r.to === from && r.kind === "related"));
  if (exists) return state;
  return {
    ...state,
    concepts: {
      ...state.concepts,
      [from]: { ...a, relations: [...a.relations, { to, kind, weight: 1, source: "learner" }] },
    },
  };
}

/** Remove an edge of a kind between two concepts, whichever side holds it. */
export function removeRelation(state: LearnerState, a: string, b: string, kind: RelationKind): LearnerState {
  const concepts = { ...state.concepts };
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    const c = concepts[x];
    if (!c) continue;
    concepts[x] = { ...c, relations: c.relations.filter((r) => !(r.to === y && r.kind === kind)) };
  }
  return { ...state, concepts };
}

/** Every edge touching a concept, from either side, with the neighbour resolved. */
export function relationsOf(
  state: LearnerState,
  conceptId: string,
): { other: Concept; kind: RelationKind; weight: number; source: "harvest" | "learner"; direction: "out" | "in" }[] {
  const out: ReturnType<typeof relationsOf> = [];
  const self = state.concepts[conceptId];
  if (!self) return out;
  for (const r of self.relations) {
    const other = state.concepts[r.to];
    if (other) out.push({ other, kind: r.kind, weight: r.weight, source: r.source ?? "harvest", direction: "out" });
  }
  for (const c of Object.values(state.concepts)) {
    if (c.id === conceptId) continue;
    for (const r of c.relations) {
      if (r.to !== conceptId) continue;
      // A cooccur pair is stored on both sides; show it once.
      if (r.kind === "cooccur" && self.relations.some((s) => s.to === c.id && s.kind === "cooccur")) continue;
      out.push({ other: c, kind: r.kind, weight: r.weight, source: r.source ?? "harvest", direction: "in" });
    }
  }
  return out.sort((x, y) => y.weight - x.weight);
}

function conceptIdsInExchange(state: LearnerState, e: Exchange): Set<string> {
  const ids = new Set<string>();
  for (const hc of e.harvest?.concepts ?? []) {
    if (hc.matchesExistingId && state.concepts[hc.matchesExistingId]) {
      ids.add(hc.matchesExistingId);
      continue;
    }
    const byName = Object.values(state.concepts).find((c) => c.name.toLowerCase() === hc.name.toLowerCase());
    if (byName) ids.add(byName.id);
  }
  return ids;
}

/** The exchanges where two concepts were harvested together: the evidence behind a cooccur edge. */
export function sharedExchanges(state: LearnerState, a: string, b: string): Exchange[] {
  return state.exchanges.filter((e) => {
    const ids = conceptIdsInExchange(state, e);
    return ids.has(a) && ids.has(b);
  });
}
