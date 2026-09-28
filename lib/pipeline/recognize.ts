import { z } from "zod";
import {
  RECOGNITION_SPACING_HOURS,
  type Concept,
  type LearnerState,
  type Persona,
  type Recognition,
  type RejectReason,
} from "@/lib/types";
import { hoursBetween, id, nowIso } from "@/lib/util";
import { checkGraduation } from "./prune";
import { addNudge } from "./triggers";

// ---------------------------------------------------------------------------
// Output schema
// ---------------------------------------------------------------------------

export const RecognizeSchema = z.object({
  proposals: z.array(
    z.object({
      conceptId: z.string(),
      quote: z.string(),
      explanation: z.string(),
      confidence: z.enum(["high", "medium", "low"]),
    }),
  ),
});

export type RecognizeOutput = z.infer<typeof RecognizeSchema>;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export const RECOGNIZE_SYSTEM = `You are the recognize step of Helm, a learning layer that runs alongside a learner's ordinary work with Claude.

You compare ONE message the learner just wrote against a small set of concepts they are actively practicing. Each concept has a rubric describing what a prompt, critique, or question looks like when someone actually has the concept.

Propose a recognition only when the learner's OWN WORDING is evidence that they have the concept:
- they specified a constraint that requires the concept ("use a partial index on status where it isn't null, and check the planner uses it"),
- they rejected or corrected an approach for a reason grounded in the concept,
- they structured the request or decomposed the problem in a way that requires the concept.

Not evidence: asking about the concept; using a term without using it correctly; wording that matches a listed "not evidence" quote; restating something the assistant said earlier.

Output rules:
- quote: the learner's exact words that count as evidence, verbatim.
- explanation: one or two sentences saying what in the phrasing is the evidence. Informational, not congratulatory: "this is evidence you understand X", never "great job".
- confidence "high" only when the wording could not plausibly have been written without the concept.
- At most ONE proposal. If several concepts qualify, pick the strongest.
- An empty proposals list is the normal, expected result for most messages.`;

export function buildRecognizePrompt(
  userMessage: string,
  activeConcepts: Concept[],
  persona: Persona,
): { system: string; user: string } {
  const conceptText = activeConcepts
    .map((c) =>
      [
        `- id: ${c.id}`,
        `  name: ${c.name}`,
        `  summary: ${c.summary}`,
        `  rubric (what having it looks like):`,
        ...c.rubric.map((r) => `    • ${r}`),
        c.rubricMisses.length
          ? `  NOT evidence (the learner said these were not the concept):\n${c.rubricMisses.map((m) => `    • "${m}"`).join("\n")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n");

  const user = `LEARNER
Name: ${persona.name}
Role: ${persona.role}

ACTIVE CONCEPTS
${conceptText || "(none)"}

LEARNER'S MESSAGE
${userMessage}

Does this message contain evidence of any active concept?`;

  return { system: RECOGNIZE_SYSTEM, user };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export function activeConceptsOf(state: LearnerState): Concept[] {
  return state.activeSet.conceptIds
    .map((cid) => state.concepts[cid])
    .filter((c): c is Concept => !!c && (c.state === "chosen" || c.state === "practicing"));
}

/**
 * Keep at most one high-confidence proposal for an active concept that
 * hasn't been recognized in the spacing window. Returns the new state and
 * the recognition that was recorded, if any.
 */
export function applyRecognizeResult(
  state: LearnerState,
  exchangeId: string,
  out: RecognizeOutput,
  now = nowIso(),
): { state: LearnerState; recognition?: Recognition } {
  const active = new Set(activeConceptsOf(state).map((c) => c.id));
  const pick = out.proposals.find((p) => {
    if (p.confidence !== "high" || !active.has(p.conceptId)) return false;
    const c = state.concepts[p.conceptId];
    const recent = c.recognitions.some(
      (r) => r.status !== "rejected" && hoursBetween(r.ts, now) < RECOGNITION_SPACING_HOURS,
    );
    return !recent && p.quote.trim().length > 0;
  });
  if (!pick) return { state };

  const recognition: Recognition = {
    id: id("rec"),
    conceptId: pick.conceptId,
    exchangeId,
    ts: now,
    quote: pick.quote.trim(),
    explanation: pick.explanation.trim(),
    status: "proposed",
  };
  const c = state.concepts[pick.conceptId];
  return {
    state: {
      ...state,
      concepts: {
        ...state.concepts,
        [c.id]: { ...c, recognitions: [...c.recognitions, recognition] },
      },
    },
    recognition,
  };
}

export type RecognitionDecision = "confirm" | RejectReason;

/**
 * The learner judges a proposed recognition. Confirmations count toward
 * graduation; each rejection reason routes somewhere useful.
 */
export function judgeRecognition(
  state: LearnerState,
  recognitionId: string,
  decision: RecognitionDecision,
  now = nowIso(),
): LearnerState {
  const concept = Object.values(state.concepts).find((c) =>
    c.recognitions.some((r) => r.id === recognitionId),
  );
  if (!concept) return state;
  const rec = concept.recognitions.find((r) => r.id === recognitionId)!;

  let updated: Concept = {
    ...concept,
    recognitions: concept.recognitions.map((r) =>
      r.id === recognitionId
        ? decision === "confirm"
          ? { ...r, status: "confirmed" }
          : { ...r, status: "rejected", rejectReason: decision }
        : r,
    ),
  };
  let next: LearnerState = state;

  switch (decision) {
    case "confirm":
      if (updated.state === "chosen") updated = { ...updated, state: "practicing" };
      break;
    case "copied":
      // Strongest possible harvest signal: frequent, and not understood.
      updated = {
        ...updated,
        signal: updated.signal + 1.0,
        lastSeen: now,
        confidence: "low",
        confidenceSource: "model",
      };
      next = addNudge(next, {
        id: id("nudge"),
        kind: "beat-offer",
        ts: now,
        conceptId: concept.id,
        exchangeId: rec.exchangeId,
        reason: `Want to understand what that ${concept.name} pattern is actually doing?`,
      });
      break;
    case "already-knew":
      updated = { ...updated, confidence: "high", confidenceSource: "learner" };
      break;
    case "not-the-concept":
      updated = { ...updated, rubricMisses: [...updated.rubricMisses, rec.quote].slice(-5) };
      break;
  }

  next = { ...next, concepts: { ...next.concepts, [concept.id]: updated } };
  return decision === "confirm" ? checkGraduation(next, now) : next;
}
