import { z } from "zod";
import type {
  Concept,
  ConceptIndexRow,
  Exchange,
  HarvestResult,
  LearnerState,
  Persona,
} from "@/lib/types";
import { id, nowIso, slug } from "@/lib/util";
import { clampImpact, decayedTo, effectiveSignal } from "./scoring";
import { addNudge } from "./triggers";

// ---------------------------------------------------------------------------
// Output schema (structured output)
// ---------------------------------------------------------------------------

export const HarvestedConceptSchema = z.object({
  name: z.string(),
  matchesExistingId: z.string().nullable(),
  summary: z.string(),
  whyItMattersHere: z.string(),
  impact: z.number(),
  learnerConfidence: z.enum(["unknown", "low", "medium", "high"]),
  evidenceFromUser: z.string(),
  rubricHints: z.array(z.string()),
});

export const HarvestSchema = z.object({
  concepts: z.array(HarvestedConceptSchema),
  learningBid: z.boolean(),
  bidConceptName: z.string().nullable(),
  pausePoint: z.boolean(),
});

export type HarvestOutput = z.infer<typeof HarvestSchema>;

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

export const HARVEST_SYSTEM = `You are the harvest step of Helm, a learning layer that runs quietly alongside a learner's ordinary work with Claude.

You read ONE exchange (the learner's message and the assistant's reply) and identify the conceptual knowledge a person would need in order to understand that exchange and its output well enough to specify it precisely, judge whether it is right, and redirect it. Then you estimate how confident we can be that this particular learner already has each concept.

Principles:
- The goal is steering capacity, not doing the work by hand. "whyItMattersHere" says what the concept lets the learner judge or specify in THIS exchange (e.g. "lets you tell whether the partial index Claude chose actually matches the query's predicate"). It never describes what the learner lacks.
- Judge confidence ONLY from what the learner wrote: vocabulary used correctly, precision of constraints, questions asked, corrections offered. The assistant's output is not evidence about the learner. If the learner's message gives no signal about a concept, confidence is "unknown".
- Prefer matching an existing concept from the index over creating a new one. When the exchange concerns something already in the index under a different wording, return that index id in matchesExistingId and reuse its name. Create a new concept only when nothing in the index covers it.
- Name concepts as a practitioner would: a 2–5 word noun phrase at the granularity a learner could practice in a 30-minute session. Not "databases"; not "the planner's behavior on this exact query"; "query planning and indexes".
- Impact (1–5) is the steering value of this concept for THIS learner given their work pattern: how often it decides whether an output is right, and how costly it is to misjudge.
- Return 1–4 concepts. Fewer, better ones.
- rubricHints: 1–3 short descriptions of what a prompt, critique, or question would look like if the learner clearly had this concept. Concrete and domain-specific, never generic.
- evidenceFromUser: the learner's own words (quoted or closely paraphrased) that informed the confidence estimate; an empty string if there were none.
- learningBid is true when the learner asked why or how something works, asked for an explanation, or said they wanted to understand — as opposed to asking for a thing to be done. bidConceptName names the concept the bid is about, or null.
- pausePoint is true when the exchange completes a piece of work: the learner accepted a result, said done / thanks / ship it, or the assistant delivered a finished artifact with nothing pending.

Tone for every text field: neutral and specific. No judgment of the learner, no praise, no "you should".`;

export function buildHarvestPrompt(
  exchange: Pick<Exchange, "user" | "assistant">,
  index: ConceptIndexRow[],
  persona: Persona,
): { system: string; user: string } {
  const indexText =
    index.length === 0
      ? "(empty — this is the learner's first harvested exchange)"
      : index
          .map(
            (r) =>
              `- id: ${r.id} | name: ${r.name} | state: ${r.state} | confidence: ${r.confidence}\n  ${r.summary}`,
          )
          .join("\n");

  const user = `LEARNER
Name: ${persona.name}
Role: ${persona.role}
Work pattern: ${persona.workPattern}

CONCEPT INDEX (existing concepts for this learner)
${indexText}

EXCHANGE
[learner]
${exchange.user}

[assistant]
${exchange.assistant}

Harvest this exchange.`;

  return { system: HARVEST_SYSTEM, user };
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

/** Signal added per sighting: 0.68 at impact 1 → 1.0 at impact 5. */
function increment(impact: number): number {
  return 0.6 + 0.4 * (impact / 5);
}

const BEAT_NUDGE_SIGNAL = 1.8;

export function toHarvestResult(out: HarvestOutput, ts = nowIso()): HarvestResult {
  return {
    concepts: out.concepts.map((c) => ({
      name: c.name.trim(),
      matchesExistingId: c.matchesExistingId,
      summary: c.summary,
      whyItMattersHere: c.whyItMattersHere,
      impact: clampImpact(c.impact),
      learnerConfidence: c.learnerConfidence,
      evidenceFromUser: c.evidenceFromUser,
      rubricHints: c.rubricHints.slice(0, 3),
    })),
    learningBid: out.learningBid,
    bidConceptName: out.bidConceptName,
    pausePoint: out.pausePoint,
    ts,
  };
}

function resolveConceptId(state: LearnerState, name: string, matches?: string | null): string {
  if (matches && state.concepts[matches]) return matches;
  const s = slug(name);
  if (state.concepts[s]) return s;
  // Case-insensitive name collision guard.
  const byName = Object.values(state.concepts).find(
    (c) => c.name.toLowerCase() === name.toLowerCase(),
  );
  return byName ? byName.id : s;
}

/**
 * Fold a harvest result into the learner model. Pure.
 * Creates or updates concepts, records evidence and co-occurrence, attaches
 * the result to the exchange, and raises the quiet nudges harvest is allowed to raise.
 */
export function applyHarvest(
  state: LearnerState,
  exchangeId: string,
  result: HarvestResult,
  now = result.ts,
): LearnerState {
  const concepts = { ...state.concepts };
  const touched: string[] = [];

  for (const hc of result.concepts) {
    const cid = resolveConceptId(state, hc.name, hc.matchesExistingId);
    const existing = concepts[cid];
    const evidence =
      hc.evidenceFromUser.trim().length > 0
        ? [{ exchangeId, quote: hc.evidenceFromUser.trim(), note: hc.whyItMattersHere, ts: now }]
        : [];

    if (!existing) {
      concepts[cid] = {
        id: cid,
        personaId: state.persona.id,
        name: hc.name,
        summary: hc.summary,
        whyItMatters: hc.whyItMattersHere,
        state: "noticed",
        confidence: hc.learnerConfidence,
        confidenceSource: "model",
        impact: hc.impact,
        signal: increment(hc.impact),
        timesSeen: 1,
        firstSeen: now,
        lastSeen: now,
        evidence,
        rubric: [...hc.rubricHints],
        rubricMisses: [],
        relations: [],
        practiceLog: [],
        recognitions: [],
        pinned: false,
      };
    } else {
      const decayed = decayedTo(existing.signal, existing.lastSeen, now);
      const timesSeen = existing.timesSeen + 1;
      const confidence =
        existing.confidenceSource === "learner" || hc.learnerConfidence === "unknown"
          ? existing.confidence
          : hc.learnerConfidence;
      const rubric = Array.from(new Set([...existing.rubric, ...hc.rubricHints])).slice(0, 6);
      concepts[cid] = {
        ...existing,
        state: existing.state === "dormant" ? "noticed" : existing.state,
        // Running average keeps impact from swinging on one exchange.
        impact: clampImpact((existing.impact * existing.timesSeen + hc.impact) / timesSeen),
        signal: decayed + increment(hc.impact),
        timesSeen,
        lastSeen: now,
        confidence,
        evidence: [...existing.evidence, ...evidence].slice(-8),
        rubric,
        whyItMatters: existing.whyItMatters || hc.whyItMattersHere,
      };
    }
    touched.push(cid);
  }

  // Co-occurrence: every pair of concepts in this exchange is related.
  for (const a of touched) {
    for (const b of touched) {
      if (a === b) continue;
      const c = concepts[a];
      const rel = c.relations.find((r) => r.to === b && r.kind === "cooccur");
      concepts[a] = {
        ...c,
        relations: rel
          ? c.relations.map((r) => (r === rel ? { ...r, weight: r.weight + 1 } : r))
          : [...c.relations, { to: b, kind: "cooccur", weight: 1 }],
      };
    }
  }

  let next: LearnerState = {
    ...state,
    concepts,
    exchanges: state.exchanges.map((e) => (e.id === exchangeId ? { ...e, harvest: result } : e)),
  };

  // Nudges harvest may raise. Never for delegated or durable concepts.
  const eligible = (c: Concept) =>
    c.state !== "delegated" &&
    c.state !== "durable" &&
    (!c.dismissedUntil || c.dismissedUntil < now);

  if (result.learningBid) {
    const bidName = result.bidConceptName?.toLowerCase();
    const bid =
      touched.map((t) => concepts[t]).find((c) => bidName && c.name.toLowerCase() === bidName) ??
      touched.map((t) => concepts[t])[0];
    if (bid && eligible(bid)) {
      next = addNudge(next, {
        id: id("nudge"),
        kind: "beat-offer",
        ts: now,
        conceptId: bid.id,
        exchangeId,
        reason: "You asked why. Want the three-minute version?",
      });
    }
  } else if (result.pausePoint) {
    const candidate = touched
      .map((t) => concepts[t])
      .filter((c) => eligible(c) && c.confidence !== "high")
      .sort((a, b) => effectiveSignal(b, now) - effectiveSignal(a, now))[0];
    if (candidate && effectiveSignal(candidate, now) >= BEAT_NUDGE_SIGNAL) {
      next = addNudge(next, {
        id: id("nudge"),
        kind: "beat-offer",
        ts: now,
        conceptId: candidate.id,
        exchangeId,
        reason: `${candidate.name} has come up ${candidate.timesSeen} times. A good moment for a beat.`,
      });
    }
  }

  return next;
}
