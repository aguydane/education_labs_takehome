import { z } from "zod";
import {
  DORMANT_SIGNAL_FLOOR,
  GRADUATION_RECOGNITIONS,
  GRADUATION_SPAN_DAYS,
  type Concept,
  type LearnerState,
  type PruneProposal,
} from "@/lib/types";
import { daysBetween, id, nowIso } from "@/lib/util";
import { candidateScore, effectiveSignal } from "./scoring";
import { addNudge } from "./triggers";

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

export const PruneSchema = z.object({
  recommended: z.array(z.object({ conceptId: z.string(), reasoning: z.string() })),
  swaps: z.array(z.object({ out: z.string(), in: z.string(), reasoning: z.string() })),
  summary: z.string(),
});

export type PruneOutput = z.infer<typeof PruneSchema>;

// ---------------------------------------------------------------------------
// Local rules (no model call)
// ---------------------------------------------------------------------------

const GONE_QUIET_DAYS = 10;
const DORMANT_AFTER_DAYS = 21;

export function isRankable(c: Concept): boolean {
  return c.state === "noticed" || c.state === "chosen" || c.state === "practicing";
}

export function rankCandidates(state: LearnerState, now = nowIso()): Concept[] {
  return Object.values(state.concepts)
    .filter(isRankable)
    .sort((a, b) => candidateScore(b, now) - candidateScore(a, now));
}

/** noticed → dormant when the signal has faded and nothing has happened for three weeks. */
export function applyDormancy(state: LearnerState, now = nowIso()): LearnerState {
  const concepts = { ...state.concepts };
  for (const c of Object.values(concepts)) {
    if (
      c.state === "noticed" &&
      !c.pinned &&
      effectiveSignal(c, now) < DORMANT_SIGNAL_FLOOR &&
      daysBetween(c.lastSeen, now) > DORMANT_AFTER_DAYS
    ) {
      concepts[c.id] = { ...c, state: "dormant" };
    }
  }
  return { ...state, concepts };
}

function lastActivity(c: Concept): string | undefined {
  const ts = [
    ...c.practiceLog.map((p) => p.ts),
    ...c.recognitions.filter((r) => r.status === "confirmed").map((r) => r.ts),
  ].sort();
  return ts[ts.length - 1];
}

/** Active concepts with no practice or confirmed recognition in 10 days. Flagged, never demoted. */
export function goneQuiet(state: LearnerState, now = nowIso()): string[] {
  return state.activeSet.conceptIds.filter((cid) => {
    const c = state.concepts[cid];
    if (!c) return false;
    const last = lastActivity(c);
    return !last || daysBetween(last, now) > GONE_QUIET_DAYS;
  });
}

/** practicing → durable after N confirmed recognitions spanning the required window. */
export function checkGraduation(state: LearnerState, now = nowIso()): LearnerState {
  let next = state;
  for (const c of Object.values(state.concepts)) {
    if (c.state !== "practicing") continue;
    const confirmed = c.recognitions.filter((r) => r.status === "confirmed").map((r) => r.ts).sort();
    if (confirmed.length < GRADUATION_RECOGNITIONS) continue;
    if (daysBetween(confirmed[0], confirmed[confirmed.length - 1]) < GRADUATION_SPAN_DAYS) continue;
    next = {
      ...next,
      concepts: { ...next.concepts, [c.id]: { ...next.concepts[c.id], state: "durable" } },
      activeSet: {
        ...next.activeSet,
        conceptIds: next.activeSet.conceptIds.filter((x) => x !== c.id),
      },
    };
  }
  void now;
  return next;
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export const PRUNE_SYSTEM = `You are the prune step of Helm, a learning layer that runs alongside a learner's ordinary work with Claude.

Helm has been harvesting concepts from the learner's real work. Your job is to recommend a small ACTIVE SET of concepts for the learner to practice next, and to explain the recommendation in plain language so the learner can decide. The learner decides; you propose.

Rules:
- Recommend exactly the requested number of concepts unless fewer are rankable.
- Rank by steering value: impact × (1 − confidence) × recent signal. The numbers are provided; explain the ranking in words a person would find useful ("this has decided whether an output was right four times in two weeks, and nothing you've written suggests you'd catch a wrong answer"), never by quoting the formula.
- The active set is sticky on purpose. Prefer keeping current active concepts. Propose at most ONE swap, and only when the challenger clearly dominates the concept it would replace. Put swaps in "swaps" and reflect them in "recommended".
- Pinned concepts stay in the recommendation no matter their score.
- An active concept with high confidence and confirmed recognitions is close to graduating to durable. Its low score is success, not a reason to swap it out; keep it and say it is nearly durable, unless a challenger clearly dominates AND the learner has nothing left to practice there.
- Never recommend concepts whose state is delegated, durable, or dormant.
- Reasoning per concept: 1–2 sentences, specific to this learner's work and interests. Neutral tone. No praise, no "you should".
- When a candidate carries a learner's note, treat it as their own judgment about the idea and weigh it; quote it back briefly if it changes the reasoning.
- summary: two sentences on the overall shape of the recommendation and the one thing the learner might want to weigh.`;

export function buildPrunePrompt(state: LearnerState, now = nowIso()): { system: string; user: string } {
  const p = state.persona;
  const active = state.activeSet.conceptIds;
  // The active set is always in front of the model, whatever its score.
  const ranked = rankCandidates(state, now);
  const activeConcepts = active.map((id) => state.concepts[id]).filter((c): c is Concept => !!c);
  const candidates = [
    ...activeConcepts,
    ...ranked.filter((c) => !active.includes(c.id)).slice(0, 12),
  ];
  const quiet = new Set(goneQuiet(state, now));

  const row = (c: Concept) => {
    const last = lastActivity(c);
    const conf = c.recognitions.filter((r) => r.status === "confirmed").length;
    return [
      `- id: ${c.id}`,
      `  name: ${c.name}`,
      `  summary: ${c.summary}`,
      `  state: ${c.state}${active.includes(c.id) ? " (in active set)" : ""}${c.pinned ? " (pinned by learner)" : ""}${quiet.has(c.id) ? " (gone quiet)" : ""}`,
      `  confidence: ${c.confidence} (${c.confidenceSource})`,
      `  impact: ${c.impact}/5 | signal: ${effectiveSignal(c, now).toFixed(2)} | seen ${c.timesSeen}× | score: ${candidateScore(c, now).toFixed(2)}`,
      `  practice sessions: ${c.practiceLog.length} | confirmed recognitions: ${conf} | last activity: ${last ? `${Math.round(daysBetween(last, now))}d ago` : "none"}`,
      c.evidence.length ? `  latest evidence: "${c.evidence[c.evidence.length - 1].quote}"` : "",
      c.notes?.length ? `  learner's latest note: "${c.notes[c.notes.length - 1].text.slice(0, 200)}"` : "",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const user = `LEARNER
Name: ${p.name}
Role: ${p.role}
Work pattern: ${p.workPattern}
Stated interests:
${p.interests.map((i) => `- ${i}`).join("\n")}

ACTIVE SET (size ${state.activeSet.size}): ${active.length ? active.join(", ") : "(empty)"}

CANDIDATES (ranked)
${candidates.map(row).join("\n")}

Recommend an active set of ${state.activeSet.size}.`;

  return { system: PRUNE_SYSTEM, user };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export function toProposal(out: PruneOutput, state: LearnerState, now = nowIso()): PruneProposal {
  const valid = (cid: string) => !!state.concepts[cid];
  return {
    ts: now,
    recommended: out.recommended.filter((r) => valid(r.conceptId)).slice(0, state.activeSet.size),
    swaps: out.swaps.filter((s) => valid(s.out) && valid(s.in)).slice(0, 1),
    goneQuiet: goneQuiet(state, now),
    summary: out.summary,
  };
}

/** Record the proposal and raise a quiet nudge. Does NOT change the active set. */
export function applyProposal(state: LearnerState, proposal: PruneProposal): LearnerState {
  const next = { ...state, activeSet: { ...state.activeSet, lastProposal: proposal } };
  return addNudge(next, {
    id: id("nudge"),
    kind: "prune-proposal",
    ts: proposal.ts,
    reason: proposal.summary,
  });
}

/** The learner's decision. */
export function setActiveSet(state: LearnerState, conceptIds: string[]): LearnerState {
  const ids = Array.from(new Set(conceptIds)).slice(0, state.activeSet.size);
  const before = new Set(state.activeSet.conceptIds);
  const after = new Set(ids);
  const concepts = { ...state.concepts };
  for (const cid of ids) {
    const c = concepts[cid];
    if (c && !before.has(cid) && (c.state === "noticed" || c.state === "dormant")) {
      concepts[cid] = { ...c, state: "chosen" };
    }
  }
  for (const cid of before) {
    const c = concepts[cid];
    if (c && !after.has(cid) && (c.state === "chosen" || c.state === "practicing")) {
      concepts[cid] = { ...c, state: "noticed" };
    }
  }
  return { ...state, concepts, activeSet: { ...state.activeSet, conceptIds: ids } };
}

export type ConceptJudgment = "know" | "dont" | "delegate" | "undelegate";

/** The three controls on a concept chip, plus the undo for delegate. */
export function judgeConcept(state: LearnerState, conceptId: string, judgment: ConceptJudgment): LearnerState {
  const c = state.concepts[conceptId];
  if (!c) return state;
  let updated: Concept = c;
  let activeIds = state.activeSet.conceptIds;
  switch (judgment) {
    case "know":
      updated = { ...c, confidence: "high", confidenceSource: "learner" };
      break;
    case "dont":
      updated = { ...c, confidence: "low", confidenceSource: "learner" };
      break;
    case "delegate":
      updated = { ...c, state: "delegated", pinned: false };
      activeIds = activeIds.filter((x) => x !== conceptId);
      break;
    case "undelegate":
      updated = { ...c, state: "noticed" };
      break;
  }
  return {
    ...state,
    concepts: { ...state.concepts, [conceptId]: updated },
    activeSet: { ...state.activeSet, conceptIds: activeIds },
  };
}

export function pinConcept(state: LearnerState, conceptId: string, pinned: boolean): LearnerState {
  const c = state.concepts[conceptId];
  if (!c) return state;
  return { ...state, concepts: { ...state.concepts, [conceptId]: { ...c, pinned } } };
}
