# Helm

*Claude does the work. You keep the understanding.*

Helm is a prototype learning layer that runs alongside ordinary work with Claude. It was built for the Anthropic Education Labs take-home (Option B: learning through collaboration with Claude). The thesis: working with AI creates constant pressure to be productive, which quietly crowds out learning. Helm makes learning feel safe and legitimate, and it aims at a specific kind of learning: **steering capacity**, understanding deep enough to specify precisely, judge output critically, and redirect it. Not doing the work by hand instead of delegating.

The design rationale lives in [docs/RATIONALE.md](docs/RATIONALE.md); the build plan that preceded the code is [docs/BUILD_PLAN.md](docs/BUILD_PLAN.md).

## The loop

1. **Harvest.** After every work exchange, a background call identifies the conceptual knowledge needed to understand that exchange and its output, and estimates from the learner's own words how confident we can be they have it. It never interrupts. Everything it records is visible on the concept chips under each message, and "keep delegating this" is one click. The "from what you wrote" quote on a chip is checked mechanically against the learner's message (`lib/pipeline/evidence.ts`): a quote lifted from Claude's reply is discarded along with the confidence estimate that leaned on it, and every quote links back to its place in the chat.
2. **Prune.** Claude proposes a small active set (three concepts) with plain-language reasoning; the learner decides, on the knowledge graph. The active set is sticky on purpose: slots turn over on graduation or explicit drop, never on novelty. Edges on the map are co-occurrence (two concepts harvested from the same exchange; thicker means more often) and can be inspected down to the exchanges behind them; the learner can also draw *related* and *prerequisite* edges by hand.
3. **Practice.** Two modes. **Beat** is a two-to-five-minute aside inside work, triggered by the learner's own bids ("why did you do it that way?") or at pause points. **Studio** is dedicated, calendar-blocked, state-saved time, entered on schedule or opportunistically while long-running agent work is in flight. Studio coaches on the learner's own past exchange, at a rung (modeling → coaching → fading) the learner can move.
4. **Recognize.** When the learner's own prompts or critiques show a concept in use, Claude proposes a recognition, quoting their words. The learner confirms or rejects with a reason, and each reason routes somewhere useful ("I copied a pattern" is the strongest possible harvest signal).

The principle throughout: **Claude observes and proposes; the learner judges.**

## Try it

Two seeded personas ship mid-story, so the loop is visible in the first minute:

- **Maya Okafor**, backend engineer at a logistics SaaS (Postgres, queues, migrations).
- **Eli Brandt**, second-year associate at a Seattle admiralty firm defending vessel owners and P&I clubs in the Bering Sea fishing fleet, mostly out of Dutch Harbor. The legal content is illustrative, not verified.

The first visit opens the **walkthrough**: a scripted loop on the real app, as Maya. Each step spotlights a live element, hands you the exact message to send when one is needed, and advances only when the real thing has happened (chips arrive, the Beat opens, the proposal returns, Studio starts, a recognition fires). It's about eight minutes, resumes across reloads, and can be restarted from the header. There is no separate tutorial: the onboarding is the product being used. Every panel also carries small "?" hints in place.

Switch personas from the header; Reset restores a persona's seed. The graph panel's dock (concept detail, edge card, proposal) can be expanded into a full-height column beside the map when you want to read it alongside the graph.

State lives in your browser (one key per persona), so every visitor gets their own sandbox.

## Run it locally

```bash
nvm use            # Node 22 (.nvmrc)
npm install
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Then open http://localhost:3000.

## Models

| Call | Model | Why |
|---|---|---|
| Work chat, Beat, Studio, Prune | `claude-opus-5-5` | Everything the learner reads |
| Harvest, Recognize, Summarize | `claude-sonnet-5` | Background extractors that run on every exchange |

Structured outputs (`messages.parse` with Zod schemas) for every JSON call; streaming for everything the learner reads; static system prompts first so they cache. Effort is set explicitly per route (Opus 5.5 always thinks; effort is the depth control).

## Architecture

```
app/api/*            seven route handlers; the only place the SDK is imported
lib/pipeline/*       pure functions over LearnerState: harvest, prune, recognize,
                     practice, triggers, graph, scoring. No UI, no HTTP.
lib/server/calls.ts  the Claude calls, shared by routes and the seed generator
lib/store/*          the storage seam: Store interface, BrowserStore, MemoryStore
lib/learner-context  the integration hook: runs calls, folds results through the pipeline
components/*         work chat, graph panel (+ collapsed rail), Beat, Studio
scripts/generate-seeds.ts   replays synthetic transcripts through the real pipeline
seeds/*.json         what the pipeline produced (not hand-written)
e2e/*                Playwright suite with the Claude routes mocked
```

The pipeline is a set of pure functions over a transcript store behind a `Store` interface. The chat UI is one transcript source; the seed generator is another. A production deployment replaces `BrowserStore` with one row per learner and runs the same functions as workers over transcripts from any Claude surface. Section 3.1 of the build plan walks through session N+1 against a durable store.

## Seeds

Seeds are generated, not authored. Synthetic work transcripts (`seeds/transcripts/*.json`) are replayed through the real harvest → prune → recognize pipeline in chronological order:

```bash
npm run seeds            # both personas, a few dollars of API spend
npm run seeds maritime   # one persona
```

The seed version is a hash of the transcript, so a visitor's stale browser state is replaced when seeds change.

## Tests

```bash
npm run typecheck
npm run lint
npm run test:e2e         # Playwright; starts the dev server if needed
```

The e2e suite mocks the Claude routes and exercises the real UI, pipeline, and store through the whole loop: harvest chips, a Beat from a why-question, prune accept, recognition confirm and reject, the long-task Studio offer, scheduled Studio with the state-save, the collapsed rail, concept controls, and persona switch/reset.

## What's deliberately out of scope

Real calendar integration (the strip is simulated), a durable store (the seam exists; the prototype uses the browser), refusal fallbacks on the Opus routes (kept the routes on the plain `parse`/`stream` path), and any claim that the maritime law is accurate.
