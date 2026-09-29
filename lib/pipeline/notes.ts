import type { Concept, LearnerState, Note, Relation, RelationKind } from "@/lib/types";
import { id, nowIso } from "@/lib/util";

/**
 * The learner's journal: notes on ideas and on the edges between them, and
 * Claude's cached speculation about an edge. Pure state transitions.
 */

export function notesOf(c: Concept): Note[] {
  return c.notes ?? [];
}

export function addConceptNote(state: LearnerState, conceptId: string, text: string, now = nowIso()): LearnerState {
  const c = state.concepts[conceptId];
  const t = text.trim();
  if (!c || !t) return state;
  const note: Note = { id: id("note"), ts: now, text: t };
  return { ...state, concepts: { ...state.concepts, [conceptId]: { ...c, notes: [...notesOf(c), note] } } };
}

export function removeConceptNote(state: LearnerState, conceptId: string, noteId: string): LearnerState {
  const c = state.concepts[conceptId];
  if (!c) return state;
  return {
    ...state,
    concepts: { ...state.concepts, [conceptId]: { ...c, notes: notesOf(c).filter((n) => n.id !== noteId) } },
  };
}

/** Find the concept that holds the relation for (a, b, kind), on either side. */
export function findRelation(
  state: LearnerState,
  a: string,
  b: string,
  kind: RelationKind,
): { holder: Concept; index: number; rel: Relation } | null {
  for (const [x, y] of [
    [a, b],
    [b, a],
  ]) {
    const c = state.concepts[x];
    if (!c) continue;
    const index = c.relations.findIndex((r) => r.to === y && r.kind === kind);
    if (index >= 0) return { holder: c, index, rel: c.relations[index] };
  }
  return null;
}

function updateRelation(
  state: LearnerState,
  a: string,
  b: string,
  kind: RelationKind,
  fn: (rel: Relation) => Relation,
): LearnerState {
  const found = findRelation(state, a, b, kind);
  if (!found) return state;
  const relations = found.holder.relations.map((r, i) => (i === found.index ? fn(r) : r));
  return { ...state, concepts: { ...state.concepts, [found.holder.id]: { ...found.holder, relations } } };
}

export function addRelationNote(
  state: LearnerState,
  a: string,
  b: string,
  kind: RelationKind,
  text: string,
  now = nowIso(),
): LearnerState {
  const t = text.trim();
  if (!t) return state;
  const note: Note = { id: id("note"), ts: now, text: t };
  return updateRelation(state, a, b, kind, (r) => ({ ...r, notes: [...(r.notes ?? []), note] }));
}

export function removeRelationNote(
  state: LearnerState,
  a: string,
  b: string,
  kind: RelationKind,
  noteId: string,
): LearnerState {
  return updateRelation(state, a, b, kind, (r) => ({ ...r, notes: (r.notes ?? []).filter((n) => n.id !== noteId) }));
}

export function setRelationInsight(
  state: LearnerState,
  a: string,
  b: string,
  kind: RelationKind,
  text: string,
  now = nowIso(),
): LearnerState {
  return updateRelation(state, a, b, kind, (r) => ({ ...r, insight: { text: text.trim(), ts: now } }));
}
