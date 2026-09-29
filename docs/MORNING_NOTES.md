# Morning notes

Written at the end of the overnight build, 2026-09-28. Read this first.

## Round 2 (after your first review, same morning)

- **Page scroll:** the document can't scroll any more (`overflow: clip` on html/body/shell blocks user *and* programmatic scrolling). New e2e test covers it.
- **State colors:** one hue per state plus a shape difference: noticed and dormant are hollow rings, chosen (teal), practicing (violet), durable (green) are filled, delegated is a warm gray with a strike. Rail chips, active-set chips and the legend swatches use the same drawing.
- **Edges:** every edge so far was a co-occurrence edge from harvest (two ideas in the same exchange; weight = number of exchanges). Now: hover shows why two ideas are joined, click opens an edge card listing the shared exchanges, and the concept detail has a Connections section where you can draw *related* or *prerequisite* links (and remove the ones you drew). `lib/pipeline/relations.ts`.
- **Evidence is checked:** you caught harvest quoting Claude's reply as "from what you wrote". The prompt now says verbatim-from-the-learner only, and `lib/pipeline/evidence.ts` checks it mechanically: a quote not found in the learner's message is dropped along with the confidence estimate that leaned on it. Ran the same check over the seeds (`npm run seeds -- --clean-evidence`): 7 backend and 11 maritime quotes were dropped (mostly paraphrases like "asked to 'write the migration'…").
- **Links back to the chat:** "Show in chat" on chip popovers, on evidence rows in the concept detail, and on edge-card exchanges scrolls the chat to the exchange and underlines the quoted words.
- **In-place explanations:** small "?" hints on every panel section, using one shared `Hint` component.
- **Walkthrough instead of a static intro (your call):** `lib/tour.ts` is the script (13 steps), `components/Tour.tsx` the engine. It spotlights live elements, offers "Send this" for the two scripted messages, and advances on real state (harvest attached, Beat answered, proposal returned, Studio mode, recognition proposed). It restores Maya's seed on Start so the steps line up, resumes across reloads, and has fallbacks for the two steps that depend on the model's judgment (a Studio offer, a recognition). Verified live through the Beat step and end to end under mocks (the e2e test walks all 13 steps).
- **Walkthrough as Eli too:** the welcome card offers "Start as Maya" / "Start as Eli"; the script is the same, in each person's voice, with Eli's why-question on the McCorpen defense and his sharpened prompt scoping the primary duty rule. Verified live through the chips step (a real Beat offer fired on maintenance and cure).
- **Studio replies were being truncated** (your report): Opus 5.5's thinking counts against `max_tokens`, and Studio was capped at 1,500. Caps raised on every Opus route; a `max_tokens` stop now shows a visible marker.
- **Dock as a third column:** `ui.dockFocused` + an Expand control on the dock; the aside widens to 70% and the dock content gets full height beside the map.
- **Tooltip on recommended nodes** shows Claude's full proposal reasoning with a label, instead of three clamped lines.

## Where things stand

**It's deployed and working end to end:** https://educationlabstakehome.vercel.app

Both personas are seeded, every step of the loop runs against real Claude calls, the production build passes, and the 11-test Playwright suite is green. Everything is committed and pushed to `main` (9 commits). The local dev server was started from this session on http://localhost:3000; if it isn't running when you sit down, `nvm use && npm run dev` brings it back.

What I verified by hand in the browser, with real API calls (not mocks), on the seeded backend persona:

- Send a work message → Opus 5.5 reply streams with markdown → concept chips arrive under it a few seconds later ("composite index design", "query plan interpretation (EXPLAIN ANALYZE)", "index write overhead tradeoffs").
- Ask a "why" question → harvest flags it as a learning bid → a quiet "You asked why. Want the three-minute version?" row appears → Take a beat → the Beat overlay streams a ≤200-word explanation using the exchange's own material and ends with one judgment question → answer it → "Noted." → back to work.
- Prune → Opus proposes an active set with per-concept reasoning and a two-sentence summary → recommended nodes get the dashed ring → Accept → nodes fill with the chosen color.
- Kick off long task → the strip appears ("Nothing is waiting on you") → after harvest, a Studio offer arrives naming the concept the task touches → Book studio time → Studio opens at the modeling rung with the "while your task runs" badge, Claude narrates and asks for a prediction → reply → "Let me try" moves to coaching, Claude switches to asking-first → Back to work → the closing-sentence form → close → back in work mode with the practice logged.
- Write a sharpened prompt on an active concept ("put carrier_id and status first as the equality columns and created_at DESC last so the LIMIT can stop early, and confirm with EXPLAIN that there's no Sort node") → a recognition card quotes it and explains why it's evidence → confirm → "Recognized: composite index design" → the node moves to practicing and the active-set strip shows "1 recognized".

And on the deployed URL: page loads with the seed, harvest route returns real output.

## The seeds

Generated, not written. The synthetic transcripts (`seeds/transcripts/`) were authored by an Opus agent from the persona briefs; the seeds themselves come from replaying those transcripts through the real pipeline (`npm run seeds`), which is what the README claims.

- **Maya (backend):** 27 concepts. Active set: composite index design (practicing, 2 confirmed recognitions, nearly durable), retry backoff strategies (practicing, 1 recognition), idempotency in job processing (chosen, quiet). One past Studio session on composite index design. Fresh proposal: keep the set; weigh safe schema migrations against idempotency.
- **Eli (maritime):** 23 concepts. Active set: McCorpen defense (practicing, 1 recognition), primary duty rule (chosen), Jones Act seaman status test (practicing, pinned, 2 recognitions on the *Chandris* and *Papai* prompts). Fresh proposal: keep the set; seaman status is nearly ready to graduate.

The recognitions in the seeds fired on their own from the transcripts' sharpened prompts, exactly the way the design says they should. That's the best evidence I have that the recognize prompt works.

## Decisions I made without you

1. **Eli pinned seaman status in his seed.** The first prune (after the 7th exchange) chose McCorpen, primary duty rule, and comparative fault, so nothing would have recognized his later *Chandris* prompts. Rather than force the model, the seed script has the learner pin the concept his stated interests name, which is the curiosity-pin feature doing its job. It's in `scripts/generate-seeds.ts` as a per-persona `PIN`, and it's logged in the seed run. If you'd rather it not be scripted, delete the map and regenerate maritime (~$1).
2. **Prune always sees the active set.** The first backend proposal wanted to swap out composite index design because its score had dropped (high confidence = low score) and it fell out of the top-12 candidates. That's success being misread as irrelevance. Fixed in `lib/pipeline/prune.ts`: active concepts are always in the prompt, and the system prompt says a high-confidence active concept is nearly durable, not a swap target. Re-pruned both seeds.
3. **No refusal fallbacks on the Opus routes.** The SDK guidance recommends them by default; they'd have pushed the routes onto the beta path and complicated `parse`/`stream`. Left out and noted in the README.
4. **Studio mode switches on before the summary returns**, so "Saving where you were…" is visible. Replies to a Studio session the learner already left are discarded. An open Studio session survives a page reload in an idle state.
5. **Pause-point Beat offers show under the exchange in chat**, not only in the graph panel as the plan said. It reads better and the harvest already anchors them to an exchange.
6. **Playwright tracing is off by default.** Trace recording hung teardown under Rosetta (see below). `--trace on` still works.
7. **Vercel:** linked the repo to your `dane-96af` team, copied `ANTHROPIC_API_KEY` from `.env.local` into the project's Production and Preview env (piped, never printed), and deployed with `vercel deploy --prod --scope dane-96af`. The per-deployment URLs are behind Vercel Authentication (hobby default); the production alias above is public. `vercel link` also appended a `VERCEL_OIDC_TOKEN` line to `.env.local`; harmless.

## What's rough

- **Graph labels hide when crowded.** The graph agent placed each label on whichever side of its node is free and hides the ones with no room (hover shows them; active and selected nodes always keep theirs). At 1024px wide, where I tested, a third of the labels are hidden; on a normal monitor most show. Dragging nodes works, positions survive collapse/expand, and there's a small inbox in the dock listing pending offers so the rail badge leads somewhere.
- **Beat and Studio replies take 8–15 seconds** to start (Opus 5.5, effort low/high). Acceptable for the demo; the streaming cursor covers it. If you want snappier Beats, drop `max_tokens` or try Sonnet 5 for Beat only.
- **The long-task simulation runs 90 real seconds** then auto-finishes. "Mark done" ends it early.
- **Recognition spacing is 24 hours per concept.** Because the seeds' last recognitions are recent, a live recognition on *composite index design* or *seaman status* won't fire again until tomorrow; use a different active concept in the demo (retry backoff, McCorpen) or reset the persona and let time pass. The e2e mocks work around this on purpose.
- **Node on this machine is x86-64 under Rosetta** (nvm installed the Intel build). Next warns about it and builds are slower than they should be. `arch -arm64 zsh -c 'source ~/.nvm/nvm.sh && nvm install 22'` would fix it; I didn't touch your Node setup beyond installing 22 alongside 14 (default unchanged; the repo has `.nvmrc`).
- **Legend copy** in the graph panel was rewritten by the graph agent; worth a read.
- The **rationale draft** (`docs/RATIONALE.md`) is assembled from our conversation. It's meant to be rewritten in your voice, not submitted.

## Cost

Seed generation ran twice for backend's final prune and twice for maritime (a full rerun for the pin), plus my live testing. Check the Console, but it should be under $10 total. A spend cap on the workspace is still worth setting before the URL goes out.

## Questions for you

1. The two personas' seeds are timestamped relative to the run (last exchange "yesterday"). They'll age: in a week the day dividers say "last week" and signals have decayed a bit. Regenerate seeds the day before you submit? It's `npm run seeds` (~$3) and the seed hash resets every visitor's browser state.
2. Do you want an access code on the URL after all? It's a five-line change in the routes if reviewers' usage worries you.
3. The demo script in the build plan (§12) still holds; the one adjustment is to use retry backoff or McCorpen for the live recognition moment (see spacing note above).

## Running things

```bash
nvm use                 # Node 22
npm run dev             # http://localhost:3000
npm run typecheck && npm run lint
npm run test:e2e        # Playwright, mocked Claude, ~25s
npm run seeds           # regenerate both seeds (~$3)
vercel deploy --prod --scope dane-96af
```

Playwright's own dev-server bootstrap uses `bash -lc` and nvm; if the suite ever can't start the server, start `npm run dev` yourself first (the config reuses a running server).
