/**
 * Helm data model.
 *
 * One LearnerState per persona. In the prototype it lives in the browser;
 * in production it is one row per learner fed by every Claude surface.
 * See docs/BUILD_PLAN.md §3–4.
 */

export type PersonaId = "backend" | "maritime";

export type Persona = {
  id: PersonaId;
  name: string;
  role: string;
  /** How this person uses Claude. Harvest uses it to judge impact. */
  workPattern: string;
  /** What the learner has said they care about. Prune respects it. */
  interests: string[];
  /** Seeds only: what the synthetic transcripts should be about. */
  domainBrief: string;
  /** "You set aside 20% for learning." */
  budgetPct: number;
};

export type ExchangeKind = "work" | "beat" | "studio";

export type Exchange = {
  id: string;
  personaId: PersonaId;
  ts: string;
  kind: ExchangeKind;
  user: string;
  assistant: string;
  /** This exchange kicked off simulated long-horizon work. */
  longTask?: boolean;
  /** Attached after the background harvest call returns. */
  harvest?: HarvestResult;
};

export type ConceptState =
  | "noticed"
  | "chosen"
  | "practicing"
  | "durable"
  | "delegated"
  | "dormant";

export type Confidence = "unknown" | "low" | "medium" | "high";

export type Rung = "modeling" | "coaching" | "fading";

export type Evidence = {
  exchangeId: string;
  /** The learner's own words. */
  quote: string;
  note: string;
  ts: string;
};

export type RelationKind = "prereq" | "related" | "cooccur";

/**
 * An edge on the map. "cooccur" edges are written by harvest whenever two
 * concepts come up in the same exchange (weight = how many exchanges);
 * "related" and "prereq" edges are drawn by the learner from the concept
 * detail pane. Stored on the `from` concept; the graph dedupes pairs.
 */
export type Relation = {
  to: string;
  kind: RelationKind;
  weight: number;
  source?: "harvest" | "learner";
};

export type PracticeEntry = {
  ts: string;
  mode: "beat" | "studio";
  rung: Rung;
  note: string;
};

export type RejectReason = "copied" | "already-knew" | "not-the-concept";

export type Recognition = {
  id: string;
  conceptId: string;
  exchangeId: string;
  ts: string;
  /** The learner's exact words that count as evidence. */
  quote: string;
  explanation: string;
  status: "proposed" | "confirmed" | "rejected";
  rejectReason?: RejectReason;
};

export type Concept = {
  id: string;
  personaId: PersonaId;
  name: string;
  summary: string;
  /** Steering value, phrased as what it lets the learner judge or specify. */
  whyItMatters: string;
  state: ConceptState;
  confidence: Confidence;
  confidenceSource: "model" | "learner";
  /** Steering value given this persona's work pattern, 1–5. */
  impact: 1 | 2 | 3 | 4 | 5;
  /** Decayed harvest signal. Half-life ~14 days. */
  signal: number;
  timesSeen: number;
  firstSeen: string;
  lastSeen: string;
  evidence: Evidence[];
  /** What a prompt or critique looks like if the learner has this. */
  rubric: string[];
  /** Quotes the learner said were NOT evidence of this concept. */
  rubricMisses: string[];
  relations: Relation[];
  practiceLog: PracticeEntry[];
  recognitions: Recognition[];
  /** Curiosity pin: protected from ranking. */
  pinned: boolean;
  /** Don't nudge about this concept until this time. */
  dismissedUntil?: string;
};

/** The projection harvest and recognize see instead of the full history. */
export type ConceptIndexRow = {
  id: string;
  name: string;
  summary: string;
  state: ConceptState;
  confidence: Confidence;
};

// ---- Pipeline results (shapes of the structured Claude outputs) ----

export type HarvestedConcept = {
  name: string;
  /** Id from the concept index when this is an existing concept. */
  matchesExistingId?: string | null;
  summary: string;
  whyItMattersHere: string;
  impact: 1 | 2 | 3 | 4 | 5;
  learnerConfidence: Confidence;
  /** The learner's words that informed the confidence estimate. */
  evidenceFromUser: string;
  rubricHints: string[];
};

export type HarvestResult = {
  concepts: HarvestedConcept[];
  /** The learner asked why/how — a bid for understanding. */
  learningBid: boolean;
  bidConceptName?: string | null;
  /** A task just completed or was accepted. */
  pausePoint: boolean;
  ts: string;
};

export type PruneProposal = {
  ts: string;
  recommended: { conceptId: string; reasoning: string }[];
  swaps: { out: string; in: string; reasoning: string }[];
  goneQuiet: string[];
  summary: string;
};

export type RecognizeProposal = {
  conceptId: string;
  quote: string;
  explanation: string;
  confidence: "high" | "medium" | "low";
};

export type RecognizeResult = {
  proposals: RecognizeProposal[];
};

// ---- Modes and triggers ----

export type NudgeKind =
  | "beat-offer"
  | "studio-offer"
  | "prune-proposal"
  | "gone-quiet";

export type Nudge = {
  id: string;
  kind: NudgeKind;
  ts: string;
  conceptId?: string;
  exchangeId?: string;
  reason: string;
  dismissed?: boolean;
};

export type BeatSession = {
  id: string;
  conceptId: string;
  exchangeId: string;
  ts: string;
  /** Claude's ≤200-word aside, with one closing question. */
  content: string;
  /** The learner's one-sentence answer, if given. */
  answer?: string;
};

export type StudioEntry = "scheduled" | "opportunistic" | "manual";

export type StudioMessage = { role: "user" | "assistant"; content: string };

export type StudioSession = {
  id: string;
  conceptId: string;
  rung: Rung;
  entry: StudioEntry;
  startedAt: string;
  endedAt?: string;
  /** Which past exchange is the material. */
  materialExchangeId?: string;
  /** The state-save: where the learner was in their work. */
  workSummary?: string;
  messages: StudioMessage[];
  /** "What would you now specify differently?" — the learner's answer. */
  closingStatement?: string;
};

export type CalendarBlock = {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  /** "14:00" */
  start: string;
  durationMin: number;
  conceptId?: string;
};

export type LongTask = {
  exchangeId: string;
  label: string;
  startedAt: string;
  durationMin: number;
};

export type LearnerState = {
  version: 1;
  /** Bumped when seeds change so stale browser state is replaced. */
  seedVersion: string;
  persona: Persona;
  exchanges: Exchange[];
  concepts: Record<string, Concept>;
  activeSet: {
    conceptIds: string[];
    size: number;
    lastProposal?: PruneProposal;
  };
  calendar: CalendarBlock[];
  nudges: Nudge[];
  beats: BeatSession[];
  studioSessions: StudioSession[];
  longTask?: LongTask;
  ui: {
    graphCollapsed: boolean;
    mode: "work" | "studio";
    activeStudioId?: string;
    /**
     * The graph panel's dock (concept detail, edge card, proposal) opens as
     * a full-height column beside the map instead of below it.
     */
    dockFocused?: boolean;
  };
};

// ---- Constants ----

export const SIGNAL_HALF_LIFE_DAYS = 14;
export const DORMANT_SIGNAL_FLOOR = 0.15;
export const GRADUATION_RECOGNITIONS = 3;
export const GRADUATION_SPAN_DAYS = 14;
export const RECOGNITION_SPACING_HOURS = 24;
export const DEFAULT_ACTIVE_SET_SIZE = 3;
