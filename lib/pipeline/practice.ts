import type {
  BeatSession,
  Concept,
  Exchange,
  LearnerState,
  Persona,
  Rung,
  StudioEntry,
  StudioMessage,
  StudioSession,
} from "@/lib/types";
import { id, nowIso } from "@/lib/util";

// ---------------------------------------------------------------------------
// Rung selection: modeling → coaching → fading
// ---------------------------------------------------------------------------

/**
 * First contact with low or unknown confidence gets modeling. A concept with
 * some practice behind it gets coaching (do it by hand, Claude asks before
 * telling). Several sessions or a confirmed recognition gets fading.
 */
export function chooseRung(c: Concept): Rung {
  const sessions = c.practiceLog.filter((p) => p.mode === "studio").length;
  const confirmed = c.recognitions.filter((r) => r.status === "confirmed").length;
  if (sessions >= 3 || confirmed >= 1) return "fading";
  if (sessions >= 1 || c.confidence === "medium" || c.confidence === "high") return "coaching";
  return "modeling";
}

const RUNGS: Rung[] = ["modeling", "coaching", "fading"];

/** "more help" → down a rung; "let me try" → up a rung. */
export function adjustRung(rung: Rung, direction: "more-help" | "let-me-try"): Rung {
  const i = RUNGS.indexOf(rung);
  const j = direction === "more-help" ? Math.max(0, i - 1) : Math.min(RUNGS.length - 1, i + 1);
  return RUNGS[j];
}

// ---------------------------------------------------------------------------
// Beat prompt
// ---------------------------------------------------------------------------

export const BEAT_SYSTEM = `You are Claude in "Beat" mode inside Helm, a learning layer that runs alongside a learner's ordinary work.

A beat is a two-to-five-minute aside inside work. The learner just took one. Your job is to make the WHY behind what was just done understandable, using the material of the exchange itself, and then get out of the way.

Rules:
- At most 200 words.
- Use the exchange's own material (its query, clause, config, argument), not textbook examples.
- Explain the reasoning behind the choice that was made, and what would have made a different choice right. The goal is steering capacity: the learner should be able to judge this kind of output next time, not reproduce it by hand.
- End with exactly one question the learner can answer in a single sentence, about a judgment they'd make, not a fact to recall.
- No quiz framing, no praise, no "great question", no bullet lists of tips.
- Do not offer to continue or ask if they want more; the interface handles the exit.`;

export function buildBeatPrompt(
  concept: Concept,
  exchange: Pick<Exchange, "user" | "assistant">,
  persona: Persona,
): { system: string; user: string } {
  const user = `LEARNER: ${persona.name}, ${persona.role}.

CONCEPT: ${concept.name}
${concept.summary}
Why it matters for this learner: ${concept.whyItMatters}

THE EXCHANGE THE BEAT IS ABOUT
[learner]
${exchange.user}

[assistant]
${exchange.assistant}

Give the beat.`;
  return { system: BEAT_SYSTEM, user };
}

// ---------------------------------------------------------------------------
// Studio prompt
// ---------------------------------------------------------------------------

const RUNG_INSTRUCTIONS: Record<Rung, string> = {
  modeling: `RUNG: MODELING. This is the learner's first real contact with the concept. You do the work on the material and narrate your reasoning as you go: what you're looking at, what you're deciding, what would change your mind. Keep each turn short (under 180 words). After each step, ask the learner to predict the next step or to say what they'd check before trusting it. Do not ask them to produce anything from scratch yet.`,
  coaching: `RUNG: COACHING. The learner does the work by hand on the material; you ask before you tell. Open by handing them the first concrete task on the material and asking how they'd approach it. When they answer, respond to what they actually wrote: name what's sound, then ask the one question that exposes the gap, if any. Give a hint only when asked or after two stuck turns, and make it the smallest hint that unblocks. Never write the full answer unless they say "just show me".`,
  fading: `RUNG: FADING. The learner works largely alone. Open by setting the task on the material and then stay quiet: reply only to what they ask, and answer narrowly. Do not volunteer corrections unless they'd lead somewhere dangerous. Your job here is to be available, not present.`,
};

export const STUDIO_SYSTEM_BASE = `You are Claude in "Studio" mode inside Helm, a learning layer that runs alongside a learner's ordinary work.

Studio is dedicated, protected time the learner set aside to actually understand one concept. Their work is saved; nothing is waiting on them. The goal is STEERING CAPACITY: at the end they should be able to specify this kind of work precisely, judge whether an output is right, and redirect it. Doing it by hand is the method; steering is the measure.

Always:
- Work on the learner's OWN past exchange (provided below), not a textbook example. Refer to it concretely.
- Match the current rung (below). The interface lets the learner move rungs: "more help" drops one, "let me try" raises one. A rung change arrives as a bracketed note in the learner's message; follow it from then on.
- Keep turns short. One idea or one task per turn.
- Neutral, warm, direct. No praise inflation, no "great question", no emoji.
- When the learner says they're done, or after roughly 6–8 turns, CLOSE the session: ask them to state in one sentence what they would now specify differently in a prompt about this kind of work. Wait for that sentence. Then say the session is closed in one line. That sentence is the seed of a future recognition.`;

export function buildStudioSystem(
  concept: Concept,
  rung: Rung,
  material: Pick<Exchange, "user" | "assistant" | "ts"> | undefined,
  persona: Persona,
  resumed = false,
): string {
  const materialText = material
    ? `THE LEARNER'S OWN PAST EXCHANGE (the material for this session)
Date: ${material.ts.slice(0, 10)}
[learner]
${material.user}

[assistant]
${material.assistant}`
    : `No past exchange was selected; ask the learner for a recent piece of their own work on this concept and use that.`;

  const history = concept.practiceLog.length
    ? `PRACTICE SO FAR: ${concept.practiceLog.map((p) => `${p.mode}/${p.rung} on ${p.ts.slice(0, 10)}`).join("; ")}`
    : "PRACTICE SO FAR: none";

  const notes = (concept.notes ?? []).slice(-5);
  const journal = notes.length
    ? `THE LEARNER'S OWN NOTES ON THIS IDEA (their journal; build on it, and refer to it when it's relevant)\n${notes
        .map((n) => `- ${n.ts.slice(0, 10)}: ${n.text}`)
        .join("\n")}`
    : "";

  return `${STUDIO_SYSTEM_BASE}

LEARNER: ${persona.name}, ${persona.role}.
Work pattern: ${persona.workPattern}

CONCEPT: ${concept.name}
${concept.summary}
Why it matters for this learner: ${concept.whyItMatters}
${concept.rubric.length ? `What having it looks like:\n${concept.rubric.map((r) => `- ${r}`).join("\n")}` : ""}
${history}
${journal ? `\n${journal}\n` : ""}
${RUNG_INSTRUCTIONS[rung]}
${resumed ? "\nTHIS SESSION WAS REOPENED after a break to dig in further. Pick up where the thread left off; don't restart from the beginning, and don't ask the closing question again until the learner is done this time.\n" : ""}
${materialText}`;
}

/** The first turn: the interface sends this as the learner's opening message. */
export const STUDIO_OPENING_USER = "[Session start] I'm here. Let's begin.";

// ---------------------------------------------------------------------------
// Summarize prompt (the state-save on entering Studio)
// ---------------------------------------------------------------------------

export const SUMMARIZE_SYSTEM = `You write the "where you were" card that Helm shows a learner when they step out of their work into a Studio session, and again when they come back. Three short lines, plain text, no headings:
1. What they were working on (one line).
2. Where it stands right now (one line).
3. The next thing they'd do when they return (one line).
Neutral and concrete. No advice, no encouragement.`;

export function buildSummarizePrompt(recent: Exchange[]): { system: string; user: string } {
  const text = recent
    .map((e) => `[learner]\n${e.user}\n\n[assistant]\n${e.assistant.slice(0, 1200)}`)
    .join("\n\n---\n\n");
  return {
    system: SUMMARIZE_SYSTEM,
    user: `RECENT WORK (oldest first)\n\n${text || "(no recent work)"}\n\nWrite the card.`,
  };
}

// ---------------------------------------------------------------------------
// State transitions
// ---------------------------------------------------------------------------

function markPracticing(c: Concept): Concept {
  return c.state === "chosen" ? { ...c, state: "practicing" } : c;
}

export function recordBeat(
  state: LearnerState,
  beat: Omit<BeatSession, "id" | "ts"> & { ts?: string },
  now = nowIso(),
): { state: LearnerState; beat: BeatSession } {
  const full: BeatSession = { id: id("beat"), ts: now, ...beat };
  const c = state.concepts[beat.conceptId];
  const concepts = c
    ? {
        ...state.concepts,
        [c.id]: {
          ...markPracticing(c),
          signal: c.signal + 0.5,
          lastSeen: now,
          practiceLog: [
            ...c.practiceLog,
            { ts: now, mode: "beat" as const, rung: "modeling" as const, note: "Beat" },
          ],
        },
      }
    : state.concepts;
  return { state: { ...state, concepts, beats: [...state.beats, full] }, beat: full };
}

export function answerBeat(state: LearnerState, beatId: string, answer: string): LearnerState {
  return {
    ...state,
    beats: state.beats.map((b) => (b.id === beatId ? { ...b, answer } : b)),
  };
}

export function startStudio(
  state: LearnerState,
  opts: {
    conceptId: string;
    entry: StudioEntry;
    materialExchangeId?: string;
    workSummary?: string;
    rung?: Rung;
  },
  now = nowIso(),
): { state: LearnerState; session: StudioSession } {
  const c = state.concepts[opts.conceptId];
  const session: StudioSession = {
    id: id("studio"),
    conceptId: opts.conceptId,
    rung: opts.rung ?? (c ? chooseRung(c) : "modeling"),
    entry: opts.entry,
    startedAt: now,
    materialExchangeId: opts.materialExchangeId,
    workSummary: opts.workSummary,
    messages: [],
  };
  return {
    state: {
      ...state,
      concepts: c ? { ...state.concepts, [c.id]: markPracticing(c) } : state.concepts,
      studioSessions: [...state.studioSessions, session],
      ui: { ...state.ui, mode: "studio", activeStudioId: session.id },
    },
    session,
  };
}

export function appendStudioMessage(state: LearnerState, sessionId: string, msg: StudioMessage): LearnerState {
  return {
    ...state,
    studioSessions: state.studioSessions.map((s) =>
      s.id === sessionId ? { ...s, messages: [...s.messages, msg] } : s,
    ),
  };
}

export function setStudioRung(state: LearnerState, sessionId: string, rung: Rung): LearnerState {
  return {
    ...state,
    studioSessions: state.studioSessions.map((s) => (s.id === sessionId ? { ...s, rung } : s)),
  };
}

export function endStudio(
  state: LearnerState,
  sessionId: string,
  closingStatement?: string,
  now = nowIso(),
): LearnerState {
  const session = state.studioSessions.find((s) => s.id === sessionId);
  if (!session) return { ...state, ui: { ...state.ui, mode: "work", activeStudioId: undefined } };
  const c = state.concepts[session.conceptId];
  const concepts = c
    ? {
        ...state.concepts,
        [c.id]: {
          ...c,
          practiceLog: [
            ...c.practiceLog,
            {
              ts: now,
              mode: "studio" as const,
              rung: session.rung,
              note: closingStatement ? `Closing: ${closingStatement}` : "Studio session",
            },
          ],
        },
      }
    : state.concepts;
  return {
    ...state,
    concepts,
    studioSessions: state.studioSessions.map((s) =>
      s.id === sessionId ? { ...s, endedAt: now, closingStatement } : s,
    ),
    ui: { ...state.ui, mode: "work", activeStudioId: undefined },
  };
}

/** The most recent work exchange that touched this concept, for Studio material. */
export function pickMaterial(state: LearnerState, conceptId: string): Exchange | undefined {
  const c = state.concepts[conceptId];
  if (!c) return undefined;
  const evidenceIds = new Set(c.evidence.map((e) => e.exchangeId));
  const work = [...state.exchanges].filter((e) => e.kind === "work").reverse();
  return (
    work.find((e) => evidenceIds.has(e.id)) ??
    work.find((e) =>
      e.harvest?.concepts.some(
        (hc) => hc.matchesExistingId === conceptId || hc.name.toLowerCase() === c.name.toLowerCase(),
      ),
    ) ??
    work[0]
  );
}
