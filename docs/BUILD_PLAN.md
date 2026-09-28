# Build plan

Working name: **Helm** (alternatives: Ballast, Keep). "Claude does the work; you keep the understanding."

This is the plan for the prototype, written before any code. It is meant to be steered: every section ends with the decisions it depends on, and the last section collects them. Once approved it becomes the skeleton of the written design rationale.

## 1. What we're building

A web app where a learner does ordinary work with Claude, and a background loop turns that work into a small, self-directed, durable curriculum:

- **Harvest** — after each exchange, identify the conceptual knowledge needed to understand it, and estimate how confident we are the learner has it. Never interrupts.
- **Prune** — Claude proposes a small active set (2–3 concepts) with reasoning; the learner decides, on a knowledge graph.
- **Practice** — two modes. **Beat**: 2–5 minutes inside work, triggered by the learner's own bids ("why did you do it that way?") or at pause points. **Studio**: dedicated, calendar-blocked, state-saved; entered on schedule or opportunistically while long-running agent work is in flight.
- **Recognize** — later, when the learner's own prompts or critiques show the concept in use, Claude proposes a recognition; the learner confirms or rejects with a reason.

Principles the code has to honor:

1. The goal is **steering capacity** (specify, judge, redirect), not doing the work by hand. By-hand practice is the method in Studio; steering evidence is the success criterion.
2. **Claude observes and proposes; the learner judges.** No auto-swaps, no asserted recognitions, no hidden state.
3. Harvest is **legibly for the learner**: everything it records is visible and correctable, and "keep delegating this" is one click.
4. Recognition is **informational, not evaluative** (no points, no streaks, no gold stars).
5. The active set is **sticky**. Slots turn over on graduation or explicit drop, not on novelty.

## 2. Stack and deployment

| Layer | Choice | Why |
|---|---|---|
| App | Next.js (App Router) + TypeScript + Tailwind | One repo, API routes for the server-side Claude calls, trivial Vercel deploy |
| Claude | `@anthropic-ai/sdk` from server routes only | API key never reaches the browser |
| State | Browser (localStorage/IndexedDB), seeded from JSON; server routes are stateless | Each reviewer gets their own sandbox, no DB to provision, "reset persona" is a one-liner |
| Graph | `d3-force` layout rendered as React SVG | 25–40 nodes; SVG gives full control over state styling and animation |
| Deploy | Vercel, `ANTHROPIC_API_KEY` as an env var, Console spend cap | Reviewers get a URL |
| Access | Open URL | Spend cap in the Console; a light per-IP rate limit on the routes |

Local toolchain note: the machine has Node 14, which Next.js will not run on (needs 18.18+). Step 0 installs a current Node via nvm.

## 3. Architecture

```
browser (React)
  ├─ Work chat ──────────────► POST /api/chat        (stream)
  │    └─ margin chips ◄────── POST /api/harvest     (structured JSON)
  │    └─ recognition cards ◄─ POST /api/recognize   (structured JSON)
  ├─ Graph panel ────────────► POST /api/prune       (structured JSON)
  ├─ Beat overlay ───────────► POST /api/beat        (stream)
  ├─ Studio view ────────────► POST /api/studio      (stream, multi-turn)
  │    └─ state-save card ◄─── POST /api/summarize   (short text)
  └─ LearnerState in browser storage (seeded from /seeds/<persona>.json)

lib/pipeline/   pure functions over LearnerState — no UI, no HTTP
  harvest.ts    buildHarvestPrompt, applyHarvest(state, result)
  prune.ts      decaySignals(state, now), buildPrunePrompt, applyProposal
  recognize.ts  buildRecognizePrompt, applyRecognition
  graph.ts      deriveGraph(state) → nodes/edges

lib/store/      the storage seam
  types.ts      interface Store { appendExchange, getExchange, getConceptIndex, getConcepts, applyEvent, ... }
  browser.ts    BrowserStore — localStorage implementation used by the prototype
  (a PostgresStore would be one more file; nothing above this line changes)

scripts/generate-seeds.ts   persona brief → synthetic exchanges → runs the SAME lib/pipeline
```

The important structural choice: **the pipeline is a set of pure functions over a transcript store, behind a storage interface.** The chat UI is just one transcript source; the seed script is another. This is the honest basis for the "how this scales" claim in the rationale: the same code could run over Claude.ai transcripts, Claude Code sessions, or a plugin's hook events.

### 3.1 How this scales: session N+1 against a durable store

The prototype keeps one `LearnerState` in the browser. In production that object is one row per learner in a durable store, fed by every Claude surface, and the same pipeline functions run as workers instead of route handlers. Concretely, suppose a learner has done N = 40 sessions over six weeks across Claude Code on a laptop, Claude.ai on a phone, and the Helm web app. The store holds about 400 exchanges, 60 concepts (5 active, 3 durable, 8 delegated, the rest noticed or dormant), and an append-only event log of harvests, recognitions, proposals, practice sessions, and the learner's judgments.

Session N+1 starts in Claude Code:

1. **Ingest.** A hook (or transcript sync) posts each exchange to the store as it lands: source, session id, user text, assistant text, timestamp. Append only. No model call yet.
2. **Harvest, online.** The ingestion event wakes the harvest worker. Its prompt is the exchange plus a *projection* of the learner model, not the history: the concept index (id, name, one-line summary, state; ~60 rows, a few thousand tokens, cacheable because it changes slowly) and the persona's work pattern. Output is the same `HarvestResult` as the prototype; `applyHarvest` writes the same signal, evidence, and confidence updates to the row. Cost per exchange is bounded by the size of the exchange and the index, not by N.
3. **Recognize, online.** On the user message only, against the five active concepts' rubrics. A hit writes a `recognition:proposed` event and is surfaced wherever the learner is: a notification in Claude Code, a card in Claude.ai, the panel in Helm. The confirm or reject comes back from any surface and is written as an event. Cross-surface recognition is the payoff: "three weeks ago in Claude.ai you asked me to make this query faster; today in Claude Code you asked for a partial index and a planner check."
4. **Triggers.** `learningBid` and `pausePoint` from harvest become `beat:offered` events rendered by the current surface. In Claude Code the long-horizon trigger stops being a simulated button: a hook knows when an agent run starts and how long it's likely to take.
5. **Nightly batch.** Decay, graduation checks, gone-quiet flags, and a consolidation pass that looks at concepts created that day against the index to merge duplicates, propose relations, and refresh rubrics from new evidence. A prune proposal is generated only when a threshold was crossed or a Studio block is within 24 hours. All of it runs through the Batch API at half price.
6. **Session N+2** starts with the projection already current. Nothing re-reads the 400 exchanges; the full transcript is retained only for point lookups (evidence quotes, and Studio pulling a specific past exchange as material).

Why it holds up: per-exchange work is O(exchange + concept index), and the index is capped by pruning and dormancy (a learner realistically carries well under 200 live concepts). Consolidation is periodic and batched. Surfaces have two jobs only: post exchanges, and render offers and recognitions while accepting judgments. The learner model is one row, so every device shows the same graph. Privacy follows from principle 3: the store keeps the model, short evidence quotes, and whatever transcript retention the host product already has; deleting a concept deletes its evidence.

The prototype mirrors this deliberately: `LearnerState` is the row, `exchanges` is the transcript store, `lib/pipeline` is the workers, `scripts/generate-seeds.ts` is a batch ingest of N sessions, and `lib/store/types.ts` is the seam where a database would go.

## 4. Data model

```ts
type PersonaId = "backend" | "maritime";

type Persona = {
  id: PersonaId; name: string; role: string;
  workPattern: string;      // how this person uses Claude; harvest uses it to judge impact
  domainBrief: string;      // seeds only: what the synthetic transcripts should be about
  budgetPct: number;        // "you set aside 20% for learning"
};

type Exchange = {
  id: string; personaId: PersonaId; ts: string;
  kind: "work" | "beat" | "studio";
  user: string; assistant: string;
  longTask?: boolean;       // this exchange kicked off simulated long-horizon work
  harvest?: HarvestResult;  // attached after the background call returns
};

type ConceptState = "noticed" | "chosen" | "practicing" | "durable" | "delegated" | "dormant";
type Confidence = "unknown" | "low" | "medium" | "high";

type Concept = {
  id: string; personaId: PersonaId;
  name: string; summary: string;
  state: ConceptState;
  confidence: Confidence; confidenceSource: "model" | "learner";
  impact: 1 | 2 | 3 | 4 | 5;         // steering value given this persona's work pattern
  signal: number;                     // decayed harvest signal (half-life ~14 days)
  timesSeen: number; lastSeen: string;
  evidence: { exchangeId: string; quote: string; note: string }[];
  rubric: string[];                   // what a prompt/critique looks like if the learner has this
  relations: { to: string; kind: "prereq" | "related" | "cooccur"; weight: number }[];
  practiceLog: { ts: string; mode: "beat" | "studio"; rung: "modeling" | "coaching" | "fading"; note: string }[];
  recognitions: Recognition[];
};

type Recognition = {
  id: string; conceptId: string; exchangeId: string;
  quote: string; explanation: string;
  status: "proposed" | "confirmed" | "rejected";
  rejectReason?: "copied" | "already-knew" | "not-the-concept";
};

type PruneProposal = {
  ts: string;
  recommended: { conceptId: string; reasoning: string }[];
  swaps: { out: string; in: string; reasoning: string }[];
  goneQuiet: string[];
};

type LearnerState = {
  persona: Persona;
  exchanges: Exchange[];
  concepts: Record<string, Concept>;
  activeSet: { conceptIds: string[]; size: number; lastProposal?: PruneProposal };
  calendar: { day: string; start: string; durationMin: number; conceptId?: string }[];
  workSummary?: string;   // the state-save written on entering Studio
};
```

Graduation rule (in `prune.ts`): `practicing → durable` after 3 confirmed recognitions spanning ≥ 14 days. Decay rule: `signal *= 0.5 ** (days / 14)`; a `noticed` concept whose signal drops below a floor becomes `dormant`.

## 5. The Claude calls

| Call | Model | Shape | Runs when | Notes |
|---|---|---|---|---|
| `/api/chat` | `claude-opus-5-5` | stream, effort `medium` | every work message | Plain assistant; the persona's work context in the system prompt |
| `/api/harvest` | `claude-sonnet-5` | structured output (`messages.parse`), effort `low` | after every work exchange, async | Frequent background extractor |
| `/api/prune` | `claude-opus-5-5` | structured output, effort `high` | pre-Studio ritual, threshold crossing, on demand | Infrequent, judgment-heavy |
| `/api/beat` | `claude-opus-5-5` | stream, effort `low` | learner accepts a Beat | Latency matters; keep it short |
| `/api/studio` | `claude-opus-5-5` | stream, multi-turn, effort `high` | Studio session | The coaching prompt; rung chosen by learner model |
| `/api/recognize` | `claude-sonnet-5` | structured output, effort `low` | after every work *user* message, async | Compares the message to active concepts' rubrics |
| `/api/summarize` | `claude-sonnet-5` | short text, effort `low` | entering Studio | The state-save: "where you were" in three lines |
| `scripts/generate-seeds.ts` | `claude-opus-5-5` | structured output, effort `high` | offline | Synthetic exchanges per persona, then the real pipeline |

Model notes. Opus 5.5 ($4 / $20 per MTok) always thinks; effort is the only depth control and its default is `medium`, so every route sets it explicitly. Forced `tool_choice` is gone on 5.5, which we don't need: JSON comes from structured outputs. Sonnet 5 ($2 / $10) runs adaptive thinking; the extractors set effort `low`. Conventions from the current SDK guidance: `output_config.format` via `messages.parse()` for every JSON call (no prefill, no regex on text); streaming with `finalMessage()` where we don't need token-level events; system prompts static and first so they cache; server-side refusal fallbacks on the Opus routes as the SDK recommends. Cost for a full reviewer session is well under a dollar; a Console spend cap is the real guardrail.

**Decided:** Opus 5.5 for learner-facing calls, Sonnet 5 for the background extractors.

## 6. Prompt design notes

These are the constraints each prompt has to encode. They are where the learning theory actually lands in the code, and where the transcripts should show iteration.

**Harvest.** Input: the exchange, the persona's work pattern, the current concept list (names + ids, so it can match instead of duplicate). Output: concepts `{ name, matchesExistingId?, whyItMattersHere, impact, learnerConfidence, evidenceFromUser, rubricHints[] }`, plus `learningBid: boolean` (did the user ask why/how?) and `pausePoint: boolean` (did a task just complete?). Constraints: judge confidence *only* from what the user wrote (vocabulary, precision of constraints, questions asked), never from the assistant's output; phrase `whyItMattersHere` as steering value ("lets you tell whether the index Claude chose is the right one"), never as deficiency; 1–4 concepts per exchange, prefer matching existing ones.

**Prune.** Input: concepts with signal/impact/confidence/state, the active set, the persona's stated interests, recent practice log. Output: `PruneProposal`. Constraints: rank by `impact × (1 − confidence) × signal`, then explain in plain language per concept; propose at most one swap and only if the challenger clearly dominates; respect pinned items; flag `goneQuiet` without demoting; never exceed `activeSet.size`.

**Beat.** Input: one concept, the exchange that triggered it, the rung. Constraints: ≤ 200 words; the modeling rung by default (explain the *why* behind what Claude just did, using the exchange's own material); end with exactly one question the learner can answer in a sentence; no quiz framing; offer the exit ("back to work?") explicitly.

**Studio.** Input: concept, rung, the learner's own past exchange as material, practice log. Constraints by rung: *modeling* — Claude does it and narrates its reasoning, then asks the learner to predict the next step; *coaching* — the learner does it by hand, Claude asks before telling, hints escalate on request; *fading* — Claude stays silent unless asked, then answers narrowly. Always: use the learner's real work, not textbook examples; "more help" drops a rung for this turn, "let me try" raises it; close by asking the learner to state, in one sentence, what they'd now specify differently in a prompt. That closing sentence is the seed of a future recognition.

**Recognize.** Input: the user's message, the active concepts with rubrics, recent recognitions. Output: proposals `{ conceptId, quote, explanation, confidence }`. Constraints: quote the learner's exact words; explain what in the phrasing is evidence; propose only at high confidence and at most one per message; never propose for a concept recognized in the last 24 hours (spacing); phrasing is informational ("this is evidence you understand X"), not congratulatory.

**Rejection routing** (in `recognize.ts`, no model call): `copied` → bump the concept's signal and lower confidence, queue a Beat offer; `already-knew` → confidence `high`, source `learner`, consider immediate graduation; `not-the-concept` → append the quote to a `rubricMisses` list that the next Studio/Prune call sees.

## 7. Triggers

Ordered by how much we trust them; all four are built.

1. **Long-horizon kickoff.** A "Kick off refactor (simulated, ~45 min)" action in work chat starts a fake progress indicator and offers Studio on the concept the task touches. No state-save needed; the work is running.
2. **Learning bids.** `harvest.learningBid` → a "Take a beat?" chip under the exchange. The learner initiated, so this can be a little more visible than the others.
3. **Pause points.** `harvest.pausePoint` and a concept crossing a signal threshold → a quiet nudge in the graph panel, never in the chat.
4. **Scheduled Studio.** The calendar strip shows a block; a "Jump to your Studio block" control simulates the time arriving and runs the ritual: summarize → save → enter.

Rules: never mid-flow; every dismissal is remembered (a dismissed concept doesn't re-nudge for a day); the Studio button is always visible.

## 8. The graph

Primary learning panel, not a decoration. Three jobs:

- **Prune happens here.** Recommended concepts glow with reasoning on hover; clicking toggles membership in the active set; the size cap is enforced in the UI.
- **Exploration lives here.** Nodes adjacent to the active set that the learner hasn't touched are the interest channel; a "curious" pin protects one from ranking.
- **Recognition lights it up.** State is visual weight (dormant faint, noticed thin ring, chosen filled, practicing pulsing ring, durable solid, delegated dimmed with a small "delegated" mark); a confirmed recognition animates the node once.

Edges: `cooccur` from harvest (concepts flagged in the same exchange), `prereq`/`related` proposed by the seed script. Layout: `d3-force` with a link-distance by weight, run once on load and after seed reset; nodes are draggable. Detail pane on click: summary, why it matters, evidence quotes, rubric, practice log, and the three controls (I know this / I don't / keep delegating).

## 9. Seeding

Reviewers will spend five minutes; the loop gets interesting after weeks. So each persona ships mid-story.

`scripts/generate-seeds.ts`:
1. From the persona brief, generate 12 realistic work exchanges spanning "three weeks" (timestamps spread), including two where the learner asks a why-question and one that kicks off long work.
2. Run `harvest` over each exchange, in order, applying results to state. This is the real pipeline, not hand-written output.
3. Run `prune`; take its recommendation as the active set.
4. Generate a short past Studio log for one active concept, and two confirmed recognitions for another so the graph shows mixed states (one `practicing`, one nearly `durable`, one fresh `noticed` challenger, one `delegated`).
5. Write `seeds/<persona>.json`. Hand-curate names and summaries afterwards; commit the result.

Personas:

- **Maya Okafor, backend engineer** — mid-level at a logistics SaaS, building a Postgres-backed service with a queue; leans on Claude for query tuning, migrations, concurrency, and infra config. Concept space: query planning and indexes, transaction isolation, idempotency, connection pooling, back-pressure, retries with jitter, schema migration safety.
- **Eli Brandt, maritime insurance associate** — second-year at a Seattle admiralty firm representing vessel owners and P&I insurers in the North Pacific fishing fleet, with most files coming out of Dutch Harbor (Bering Sea crab and pollock, processors, tenders). Jones Act and general maritime defense. Leans on Claude for exposure memos, discovery requests, and first drafts of motions. Concept space: seaman status and the *Chandris* connection test (processor-vessel workers, shore-side stints in Dutch Harbor), unseaworthiness vs. Jones Act negligence, maintenance and cure and the *McCorpen* defense, the primary duty rule, Limitation of Liability Act, Jones Act vs. LHWCA classification (dockside processing), P&I coverage triggers, Ninth Circuit and Western District of Washington venue and choice-of-law wrinkles. Legal content is illustrative, not verified, and the README says so.

## 10. UI

Single screen, three regions, persona switcher in the header.

- **Left (≈55%): work chat.** Each assistant message gets a margin row of concept chips with a confidence dot; chips expand to "why this matters here." Bids and pause points add a "Take a beat?" chip. A "Kick off long task" action sits by the input.
- **Right (≈45%): graph panel.** Calendar strip on top ("Learning budget 20% · Thu 2–2:30 Studio: query planning · colleagues see: Busy"), the graph, an active-set strip with the Prune button, and the Studio button.
- **The graph panel collapses to a rail** (~72px) so work can have the screen. The rail is not a placeholder; it carries the state that matters while you're working: the active concepts as stacked chips with their state rings (a pulse when one just changed), an inbox badge counting pending proposals, nudges, and gone-quiet flags, the next Studio block compressed to "Thu 2p," and the Studio button. Nothing chat-anchored is lost when collapsed: Beat chips and recognition cards live in the chat. The panel never auto-expands; new things go to the badge. Collapsed state persists per persona.
- **Beat** is an overlay anchored to the exchange that triggered it; Studio takes over the left region, with the "where you were" card pinned at the top and "Back to work" restoring the chat.
- **Recognition cards** appear inline under the user message that earned them: quote, explanation, confirm / reject (three reasons).

## 11. Build order

Time-boxed; the harvest step is deliberately first because everything downstream consumes its output and it's where the most prompt iteration happens.

| # | Step | Box |
|---|---|---|
| 0 | Node upgrade, Next.js scaffold, SDK, `.env`, hello-world deploy to Vercel | 0:30 |
| 1 | Types, persona briefs, harvest prompt, seed script; run over synthetic transcripts; iterate until harvest output is good on both personas | 1:30 |
| 2 | Work chat (streaming), margin chips, persona switcher, browser state, reset | 1:00 |
| 3 | Graph + prune (layout, states, detail pane, proposal UI, collapsed rail) | 2:00 |
| 4 | Beat overlay + the four triggers (long-task simulation, bids, pause, scheduled) | 1:00 |
| 5 | Studio (rung logic, more-help/let-me-try, calendar strip, state-save/restore) | 1:30 |
| 6 | Recognize + confirm/reject with reasons + graph animation + graduation | 1:00 |
| 7 | README, access code, deploy, smoke test both personas end to end | 0:45 |

Total ≈ 9:15, which is over the "< 1 day" spirit, so the cut list is real.

**Cut list, in order:** maritime persona (keep the brief in the README as "second persona designed, not seeded") → calendar strip (Studio button only) → scheduled trigger → graph animation → graph becomes a state-grouped list.

## 12. Demo script (video ≤ 8 min)

1. Thesis and the loop, on the graph (0:45).
2. Backend persona: one work exchange → chips appear → ask "why did you pick that isolation level?" → bid → Beat (1:30).
3. Prune: open proposal, read reasoning, swap one, pin a curiosity (1:00).
4. Kick off long task → Studio offer → coaching on the learner's own migration from "last week" → "let me try" → back to work with the summary card (2:00).
5. Type a sharpened prompt → recognition proposed → confirm → node lights up (1:00).
6. Switch to the maritime persona: show its graph, reject one recognition as "copied" → Beat offer (1:00).
7. Architecture and scale: pipeline over a transcript store; where this plugs into Claude products (0:45).

## 13. Risks

- **Graph time sink.** Two-hour box, hard stop, list fallback exists.
- **Harvest quality.** Concept naming and matching against the index is the whole game; test on both personas in step 1 before any UI exists.
- **Recognition false positives** would undermine trust fast. High threshold, one per message, learner confirms; the `not-the-concept` reason feeds back.
- **Latency in Beat.** Effort `low`, ≤ 200 words, streamed.
- **Cold-start demo.** Seeds. Also a "reset persona" so a reviewer can't wedge state.
- **Live key on a public URL.** Server-only key, spend cap, optional access code.
- **Legal plausibility.** Illustrative only, stated in the README.

## 14. Decisions needed

- [x] Stack: Next.js + TypeScript + Tailwind on Vercel
- [x] Access: open URL (no access code; spend cap in the Console is the guardrail)
- [x] Models: Opus 5.5 learner-facing, Sonnet 5 background
- [x] State in the browser, stateless server, behind the `Store` interface
- [x] Working name: Helm
- [x] Graph panel is collapsible to a rail
- [x] Personas: Maya Okafor (backend), Eli Brandt (maritime); concept spaces as written
- [x] Build order and cut list as written
