import type { Concept, Exchange, LearnerState, Persona, RelationKind } from "@/lib/types";

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

// ---------------------------------------------------------------------------
// Edge insight: Claude's short speculation on why two ideas meet
// ---------------------------------------------------------------------------

export const EDGE_INSIGHT_SYSTEM = `You explain one edge on a learner's concept map inside Helm, a learning layer that runs alongside their ordinary work with Claude.

Two ideas are joined, either because they came up in the same exchanges of the learner's real work, or because the learner linked them by hand. In two or three sentences, say why these two ideas keep meeting in THIS learner's work and what understanding one does for judging the other. Be concrete to the exchanges you're shown; if there are none, reason from the two ideas and the learner's role. Speculate openly ("probably", "my guess") when you're inferring. No headings, no bullets, no praise, no "you should". Plain prose, under 80 words.`;

export function buildEdgeInsightPrompt(
  a: Concept,
  b: Concept,
  kind: RelationKind,
  shared: Exchange[],
  persona: Persona,
): { system: string; user: string } {
  const how =
    kind === "cooccur"
      ? `Came up together in ${shared.length} exchange${shared.length === 1 ? "" : "s"} of the learner's work.`
      : kind === "prereq"
        ? `The learner marked "${a.name}" as a prerequisite for "${b.name}".`
        : `The learner linked these as related.`;
  const ex = shared
    .slice(-4)
    .map((e) => `- ${e.ts.slice(0, 10)}: ${e.user.slice(0, 220).replace(/\s+/g, " ")}`)
    .join("\n");
  const user = `LEARNER: ${persona.name}, ${persona.role}.
Work pattern: ${persona.workPattern}

IDEA A: ${a.name}
${a.summary}
Why it matters: ${a.whyItMatters}

IDEA B: ${b.name}
${b.summary}
Why it matters: ${b.whyItMatters}

HOW THEY'RE JOINED: ${how}
${ex ? `\nWHAT THE LEARNER WROTE IN THOSE EXCHANGES\n${ex}` : ""}

Why do these two ideas meet in this learner's work, and what does understanding one do for judging the other?`;
  return { system: EDGE_INSIGHT_SYSTEM, user };
}
