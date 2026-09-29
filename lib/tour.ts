import type { BeatUI, Busy, StudioUI } from "./learner-context";
import { pendingNudges } from "./pipeline/triggers";
import type { Exchange, LearnerState, PersonaId, Recognition } from "./types";

/**
 * The walkthrough script. It runs on the real app with the real seed:
 * every step points at a live element, hands the learner the exact message
 * to send when one is needed, and advances only when the real thing has
 * happened. This is the onboarding; there is no separate tutorial.
 */

export type TourCtx = {
  state: LearnerState;
  beat: BeatUI | null;
  studio: StudioUI | null;
  busy: Busy;
  /** When the learner pressed Start. Exchanges before it belong to the seed. */
  startedAt: string;
  dom: (selector: string) => Element | null;
  domAll: (selector: string) => Element[];
};

export type TourAnchor = Element | DOMRect | null;

export type TourStep = {
  id: string;
  title: string;
  body: string;
  /** The element (or a rect covering several) to spotlight. Undefined centers the card. */
  anchor?: (c: TourCtx) => TourAnchor;
  /** A message the learner can send with one click. */
  script?: { text: string };
  /** Auto-advance once this is true. */
  advanceWhen?: (c: TourCtx) => boolean;
  /** Shown under the body while waiting for advanceWhen. */
  waiting?: string;
  /** When this becomes true without advanceWhen, show fallbackText and a Next button. */
  fallbackWhen?: (c: TourCtx) => boolean;
  fallbackText?: string;
  /** Skip this step entirely when true on entry. */
  skipWhen?: (c: TourCtx) => boolean;
  /** No condition: a Next button. */
  manual?: boolean;
  nextLabel?: string;
};

// ---- helpers ----------------------------------------------------------------

function exchangesSince(c: TourCtx): Exchange[] {
  return c.state.exchanges.filter((e) => e.kind === "work" && e.ts >= c.startedAt);
}

function recognitionsSince(c: TourCtx): Recognition[] {
  return Object.values(c.state.concepts).flatMap((k) => k.recognitions.filter((r) => r.ts >= c.startedAt));
}

function last<T>(xs: T[]): T | undefined {
  return xs[xs.length - 1];
}

/** The chips under the newest reply, as one rect. */
function lastChipRow(c: TourCtx): TourAnchor {
  const newest = last(exchangesSince(c));
  const scope = newest ? c.dom(`[data-testid="exchange-${newest.id}"]`) : null;
  const chips = scope
    ? Array.from(scope.querySelectorAll('[data-testid^="concept-chip-"]'))
    : c.domAll('[data-testid^="concept-chip-"]').slice(-4);
  if (chips.length === 0) return null;
  const rects = chips.map((el) => el.getBoundingClientRect());
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  return new DOMRect(left, top, right - left, bottom - top);
}

function activeStudioSession(c: TourCtx) {
  const id = c.studio?.sessionId || c.state.ui.activeStudioId;
  return c.state.studioSessions.find((s) => s.id === id);
}

// ---- per-persona voice ------------------------------------------------------

type Voice = {
  first: string;
  they: string;
  their: string;
  intro: string;
  whyText: string;
  longTask: string;
  recognizeLead: string;
  recognizeText: string;
};

const VOICES: Record<PersonaId, Voice> = {
  backend: {
    first: "Maya",
    they: "she",
    their: "her",
    intro: "a backend engineer with three weeks of history here",
    whyText:
      "Why did you add full jitter to the webhook retry backoff instead of plain exponential? I thought exponential already spread the retries out.",
    longTask: "Maya is about to kick off a backfill that runs for most of an hour.",
    recognizeLead: "Maya's next message specifies retries precisely, the way someone who understands backoff would.",
    recognizeText:
      "For the carrier webhook retries: cap at 5 attempts with full jitter on a 30 s ceiling, honor Retry-After when FedEx sends one, and set pg-boss retryLimit to 0 so exactly one layer owns retries. Write the handler change.",
  },
  maritime: {
    first: "Eli",
    they: "he",
    their: "his",
    intro: "a second-year maritime defense associate with three weeks of Dutch Harbor files here",
    whyText:
      "Why do we lead with the McCorpen defense on Kowalski instead of just contesting causation on the surgery? If the fusion was coming anyway, isn't causation the cleaner argument?",
    longTask: "Eli is about to send Claude off to draft a full summary-judgment motion with record cites.",
    recognizeLead:
      "Eli's next message scopes the primary duty rule the way someone who understands its limits would, instead of asking whether it applies.",
    recognizeText:
      "For the Kowalski deck-hazard claim, argue the primary duty rule only as to the tie-down protocol he wrote and was responsible for enforcing, not the wet-deck condition generally; concede comparative fault on the lighting, and cite the rule's limits so we don't overclaim. Draft that section.",
  },
};

// ---- the script -------------------------------------------------------------

export function tourSteps(personaId: PersonaId): TourStep[] {
  const v = VOICES[personaId];
  return [
  {
    id: "welcome",
    title: "Welcome to Helm",
    body:
      "Claude does the work. You keep the understanding. The best way to see what that means is to do one full loop, for real, as one of the two people seeded here: Maya, a backend engineer, or Eli, a maritime defense associate working Dutch Harbor files. It takes about eight minutes and every step happens in the actual app. Starting restores that person's seed so the steps line up.",
    manual: true,
    nextLabel: "Start",
  },
  {
    id: "send-why",
    title: "Work like normal, and ask why",
    body:
      `Helm sits alongside ordinary work. Send ${v.first}'s next message; it happens to be a why-question about something Claude did last week. A question like that is a bid for understanding, and Helm treats it differently from a request to get something done.`,
    anchor: (c) => c.dom('[data-testid="work-composer"]'),
    script: { text: v.whyText },
    advanceWhen: (c) => exchangesSince(c).some((e) => e.harvest),
    waiting: "Claude replies, then Helm reads the exchange (about 10–20 seconds).",
  },
  {
    id: "chips",
    title: "Harvest: the ideas under a reply",
    body:
      "These chips are the ideas Claude leaned on in that reply. Helm read your message, not Claude's, to guess how sure it can be that you already have each one; that's the dot (gray unknown, amber low, teal medium, green high). It never interrupts; the chips just appear. Open one.",
    anchor: lastChipRow,
    advanceWhen: (c) => !!c.dom('[data-testid="chip-popover"]'),
    waiting: "Click any chip under the new reply.",
  },
  {
    id: "popover",
    title: "What a chip holds",
    body:
      "\"Why it matters here\" is what the idea lets you judge or specify in this exchange, not what you lack. \"From what you wrote\" is the evidence, your words only, with a link back to them. The three buttons overrule Helm: I know this, I don't, or keep delegating, which is a fine answer for most ideas. Now take the beat: from the offer under the reply, or from the button right here.",
    anchor: (c) => (c.dom('[data-testid="chip-popover"]') as TourAnchor) ?? lastChipRow(c),
    advanceWhen: (c) => c.beat !== null,
    waiting: "Click Take a beat.",
  },
  {
    id: "beat",
    title: "Beat: a short aside inside your work",
    body:
      "A beat is two to five minutes on the why, using this exchange's own material. It ends with one question about a judgment you'd make, not a fact to recall. Read it and answer in a sentence; the answer isn't graded, it's the first trace of you steering this kind of work.",
    anchor: (c) => c.dom('[data-testid="beat-overlay"]'),
    advanceWhen: (c) => c.beat?.status === "answered",
    waiting: "Claude writes the beat, then answer its question.",
  },
  {
    id: "map",
    title: "Prune: your map",
    body:
      `Close the beat (Back to work). On the right is every idea ${v.first}'s work has surfaced: hollow rings are just noticed, filled ones are ideas ${v.they} decided about, thick rings are the two or three ${v.they}'s practicing now. Lines join ideas that came up in the same exchange. Press Prune to ask Claude what the active set should be.`,
    anchor: (c) => c.dom('[data-testid="prune-button"]') ?? c.dom('[data-testid="graph-canvas"]'),
    advanceWhen: (c) => !!c.state.activeSet.lastProposal && c.state.activeSet.lastProposal.ts >= c.startedAt,
    waiting: "Press Prune (Claude takes about 15 seconds).",
  },
  {
    id: "proposal",
    title: "Claude proposes; you decide",
    body:
      "Here is the reasoning for each idea, in plain words. The set is meant to stay put for weeks, so Claude proposes at most one swap and only when it clearly wins. Untick to disagree, or keep the current set. Nothing changes until you accept.",
    anchor: (c) => c.dom('[data-testid="prune-panel"]'),
    advanceWhen: (c) =>
      !!c.state.activeSet.lastProposal &&
      c.state.activeSet.lastProposal.ts >= c.startedAt &&
      !pendingNudges(c.state).some((n) => n.kind === "prune-proposal"),
    waiting: "Accept, or Keep current.",
  },
  {
    id: "long-task",
    title: "The best moment for Studio",
    body:
      `${v.longTask} While it runs, nothing is waiting on ${v.their === "his" ? "him" : "her"}. Helm treats that wait as the best possible moment for dedicated time on one idea. Kick it off.`,
    anchor: (c) => c.dom('[data-testid="work-longtask"]'),
    advanceWhen: (c) => !!c.state.longTask || exchangesSince(c).some((e) => e.longTask),
    waiting: "Press Kick off long task.",
  },
  {
    id: "studio-offer",
    title: "Studio offer",
    body:
      "Once Helm has read the exchange it names the idea the task touches and offers Studio for the wait. Book it.",
    anchor: (c) => last(c.domAll('[data-testid^="studio-offer-nudge_"]')) ?? c.dom('[data-testid="longtask-strip"]'),
    advanceWhen: (c) => c.state.ui.mode === "studio",
    waiting: "Claude replies, Helm reads it, the offer appears under the reply. Then press Book studio time.",
    fallbackWhen: (c) => {
      const ex = last(exchangesSince(c));
      return !!ex?.longTask && !!ex.harvest && !pendingNudges(c.state).some((n) => n.kind === "studio-offer");
    },
    fallbackText: "No offer this time. Use the Studio button on the map instead.",
  },
  {
    id: "studio",
    title: "Studio: protected time on one idea",
    body:
      `Studio works on ${v.first}'s own past exchange, not a textbook example. The rung sets how much Claude does: modeling (Claude does it and narrates, you predict), coaching (you do it, Claude asks first), fading (you work, Claude is available). More help drops a rung; Let me try raises one. The "where you were" card is your work, saved, so leaving it is safe. Reply to Claude once.`,
    anchor: (c) => c.dom('[data-testid="studio-rung"]'),
    advanceWhen: (c) => {
      const s = activeStudioSession(c);
      return !!s && s.messages.some((m) => m.role === "user" && !m.content.startsWith("["));
    },
    waiting: "Claude opens the session; answer it in the composer.",
  },
  {
    id: "studio-close",
    title: "Closing a session",
    body:
      "Studio closes with one sentence: what would you now specify differently in a prompt about this kind of work? That sentence is the seed of a future recognition. Press Back to work and write it (or leave without closing).",
    anchor: (c) => c.dom('[data-testid="studio-back"]'),
    advanceWhen: (c) => c.state.ui.mode === "work",
    waiting: "Back to work, then Close session.",
  },
  {
    id: "recognize",
    title: "Recognize: evidence in your own words",
    body:
      `Helm never quizzes. It watches for your own wording showing an active idea in use: a constraint you specified, a correction you made. ${v.recognizeLead} Send it.`,
    anchor: (c) => c.dom('[data-testid="work-composer"]'),
    script: { text: v.recognizeText },
    advanceWhen: (c) => recognitionsSince(c).some((r) => r.status === "proposed"),
    waiting: "Helm reads your message as Claude replies (a few seconds).",
    fallbackWhen: (c) => {
      const ex = last(exchangesSince(c));
      return exchangesSince(c).length >= 3 && !!ex?.harvest && c.busy.recognize === 0 && recognitionsSince(c).length === 0;
    },
    fallbackText:
      "Helm didn't see enough evidence in that one, which is the normal outcome for most messages; it proposes only when the wording couldn't have been written without the idea. Carry on.",
  },
  {
    id: "confirm",
    title: "Was that really you?",
    body:
      "Helm quotes the words it took as evidence and says why. Confirm if that was you. Say no if you copied a pattern (that becomes a harvest signal), already knew it (that corrects Helm), or it isn't the idea at all (that fixes the rubric). Confirmations spread over weeks move an idea to durable.",
    anchor: (c) => last(c.domAll('[data-testid^="recognition-rec_"]')) ?? null,
    skipWhen: (c) => recognitionsSince(c).length === 0,
    advanceWhen: (c) => recognitionsSince(c).length > 0 && recognitionsSince(c).every((r) => r.status !== "proposed"),
    waiting: "Confirm, or choose a reason.",
  },
  {
    id: "done",
    title: "That's the loop",
    body:
      `Harvest, prune, practice, recognize, all inside the work. The rule everywhere: Helm observes and proposes; you judge. Every panel has small ? hints, ${personaId === "backend" ? "Eli in the header is a second person to explore as (maritime law, Dutch Harbor)" : "Maya in the header is a second person to explore as (backend engineering)"}, and Reset restores a seed. Walkthrough in the header runs this again, as either of them.`,
    anchor: (c) => c.dom('[data-testid="active-set-strip"]'),
    manual: true,
    nextLabel: "Finish",
  },
  ];
}
