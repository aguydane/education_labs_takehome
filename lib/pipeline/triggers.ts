import type { LearnerState, Nudge } from "@/lib/types";
import { id, nowIso } from "@/lib/util";
import { effectiveSignal } from "./scoring";

/** Add a nudge, replacing any undismissed nudge of the same kind for the same concept. */
export function addNudge(state: LearnerState, nudge: Nudge): LearnerState {
  const kept = state.nudges.filter(
    (n) => n.dismissed || n.kind !== nudge.kind || n.conceptId !== nudge.conceptId,
  );
  return { ...state, nudges: [...kept, nudge] };
}

export function pendingNudges(state: LearnerState): Nudge[] {
  return state.nudges.filter((n) => !n.dismissed);
}

/** Dismissals are remembered: the concept won't be nudged again for a day. */
export function dismissNudge(state: LearnerState, nudgeId: string, now = nowIso()): LearnerState {
  const nudge = state.nudges.find((n) => n.id === nudgeId);
  if (!nudge) return state;
  const until = new Date(new Date(now).getTime() + 24 * 3_600_000).toISOString();
  const concepts = { ...state.concepts };
  if (nudge.conceptId && concepts[nudge.conceptId]) {
    concepts[nudge.conceptId] = { ...concepts[nudge.conceptId], dismissedUntil: until };
  }
  return {
    ...state,
    concepts,
    nudges: state.nudges.map((n) => (n.id === nudgeId ? { ...n, dismissed: true } : n)),
  };
}

export function resolveNudge(state: LearnerState, nudgeId: string): LearnerState {
  return {
    ...state,
    nudges: state.nudges.map((n) => (n.id === nudgeId ? { ...n, dismissed: true } : n)),
  };
}

/** The learner kicked off long-horizon work: the best moment to offer Studio. */
export function startLongTask(
  state: LearnerState,
  exchangeId: string,
  label: string,
  durationMin = 45,
  now = nowIso(),
): LearnerState {
  return {
    ...state,
    longTask: { exchangeId, label, startedAt: now, durationMin },
    exchanges: state.exchanges.map((e) => (e.id === exchangeId ? { ...e, longTask: true } : e)),
  };
}

export function finishLongTask(state: LearnerState): LearnerState {
  const { longTask: _drop, ...rest } = state;
  void _drop;
  return rest;
}

/**
 * Pick the concept to offer for the wait. Prefer an active concept the
 * task's exchange touched; then the strongest concept from that exchange;
 * then the top active concept.
 */
export function pickStudioConceptForTask(state: LearnerState, exchangeId: string, now = nowIso()): string | undefined {
  const ex = state.exchanges.find((e) => e.id === exchangeId);
  const active = new Set(state.activeSet.conceptIds);
  const harvested = (ex?.harvest?.concepts ?? [])
    .map((hc) => {
      const byId = hc.matchesExistingId && state.concepts[hc.matchesExistingId];
      const byName = Object.values(state.concepts).find(
        (c) => c.name.toLowerCase() === hc.name.toLowerCase(),
      );
      return byId || byName;
    })
    .filter((c): c is NonNullable<typeof c> => !!c && c.state !== "delegated" && c.state !== "durable");

  const inActive = harvested.find((c) => active.has(c.id));
  if (inActive) return inActive.id;
  const strongest = [...harvested].sort((a, b) => effectiveSignal(b, now) - effectiveSignal(a, now))[0];
  if (strongest) return strongest.id;
  return state.activeSet.conceptIds[0];
}

export function offerStudioForTask(state: LearnerState, exchangeId: string, now = nowIso()): LearnerState {
  const conceptId = pickStudioConceptForTask(state, exchangeId, now);
  if (!conceptId) return state;
  const c = state.concepts[conceptId];
  return addNudge(state, {
    id: id("nudge"),
    kind: "studio-offer",
    ts: now,
    conceptId,
    exchangeId,
    reason: `That's going to run for a while. Want to use the wait to actually understand ${c.name}?`,
  });
}
