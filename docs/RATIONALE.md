# Helm — design rationale

*Claude does the work. You keep the understanding.*

Prototype: https://educationlabstakehome.vercel.app · Code: https://github.com/aguydane/education_labs_takehome · The walkthrough opens on first visit and can be restarted from the header, as either seeded person.

## 1. The problem

I chose Option B, learning through collaboration with Claude, because it names a need I feel in my own work.

Before AI assistance, learning was integrated with engineering. I went deep on principles because the problem in front of me required it; I couldn't build what I didn't understand. That rigor is what drew me to the field, and it's the thing I now lose unless I'm intentional. The work still gets done, faster than ever. The understanding no longer has to come along.

The question, then, is how to keep developing mastery while working in an accelerated loop with an AI assistant. Not by slowing down, and not by refusing to delegate: the models will apply most skills faster and more capaciously than I will. What my own understanding buys me is **steering capacity**: more precise intentions, a sharper eye for whether an output is going where I meant, the range to cross into adjacent territory. Understanding deep enough to specify, judge, and redirect.

Two design requirements follow, and they became the product's two halves. It has to make stepping back to learn feel legitimate inside a working day, since over the long run productivity rises once that feels safe; that half is Beat and Studio. And it has to show you that learning is already happening through the act of doing, even mid-sprint; that half is Harvest and Recognize, whose job is to notice that learning and hand it back.

Against Option B's own terms: domain expertise develops on the learner's real material rather than a curriculum; AI-assisted work becomes a learning opportunity at exactly the moments a learner would otherwise wait or wonder why; understanding deepens through the same conversations that get the work done; and the measure of growth is what the learner can now specify and judge, not what they completed.

## 2. What I built

Helm is a web app (Next.js on Vercel, Claude API on the server) that runs a four-step loop alongside ordinary work with Claude. It ships with two seeded people, Maya, a backend engineer, and Eli, a maritime defense associate working Dutch Harbor files, each with three weeks of history. Onboarding is a scripted walkthrough on the real app rather than a tutorial.

*[Figure: the loop. Figure: the map, with the legend.]*

**Harvest.** After every exchange, a background call identifies the ideas a person would need in order to have produced it, and estimates, from the learner's own words only, how confident we can be that they already have each one. It never interrupts. The result appears as chips under the reply, each with "I know this," "I don't," and "keep delegating."

**Prune.** Claude proposes a small active set of ideas to practice, with reasoning; the learner decides, on a map of every idea their work has surfaced. Slots turn over when an idea graduates or the learner drops it, never because something newer arrived.

**Practice.** *Beat* is a two-to-five-minute aside inside the work, offered when the learner asks why or when a piece of work wraps up. *Studio* is dedicated, calendar-blocked, state-saved time on one idea, using the learner's own past exchange as material, at a rung the learner controls: modeling, coaching, or fading. Studio starts on schedule or in the wait after the learner kicks off long-running agent work.

**Recognize.** When the learner's own prompts or critiques show an idea in use, Claude proposes a recognition, quoting the words and saying why they count. The learner confirms or rejects with a reason. Confirmations spread over weeks move an idea to durable.

The map doubles as a journal: notes on ideas and on the connections between them, Claude's speculation on why two ideas keep meeting in the learner's work, and a history of Studio sessions that can be reopened.

**A day with it.** Maya asks Claude why it chose full jitter for a retry backoff. Chips appear under the reply; one offers a beat, and three minutes later she has answered a question about when jitter matters. She kicks off a backfill that will run for most of an hour; Helm offers Studio on the idea the backfill touches, saves where she was, and coaches her through her own migration from last week at whatever rung she wants. Back at work, she writes a retry policy precisely enough that Helm recognizes the idea in her words and asks whether that was really her. Nothing in the day was a lesson.

**How it's built.** The pipeline is a set of pure functions over a transcript store (harvest, prune, recognize, practice, triggers, graph) behind a storage interface with a browser implementation; the Claude calls are seven route handlers; the UI is three panels and two modes. The seeded histories were not written by hand: synthetic work transcripts were replayed through the real pipeline, so what reviewers see on first load is what the system produces. A Playwright suite walks the whole loop with the Claude routes mocked, and every build was also verified live against the real model.

## 3. Who it's for, and how it generalizes

The brief asks for people who already use Claude and want more from it, not first-time users, and Helm assumes ongoing work: it has nothing to say to an empty history. Within that, it doesn't know or care what the work is. The concept space isn't a taxonomy; it's harvested from the learner's own exchanges and named the way a practitioner in that field would name it. The same prompts, with no domain configuration, produced *composite index design* and *idempotency in job processing* for a backend engineer and *the Chandris connection test* and *the McCorpen defense* for a maritime associate. That is why the second seeded person comes from an unrelated field: Eli is the generalization test.

Skill level is handled per idea rather than per user. Harvest estimates confidence from wording and the learner overrides it; the Studio rung starts from that estimate and moves; "keep delegating" lets an expert clear away what they don't need. A senior engineer and a junior associate use the same product and see different maps. Students and professionals differ mainly in where the protected time comes from: for a professional it's a calendar block and the wait on an agent; for a student it's study time already on the calendar, which is where the strip would point. What doesn't generalize yet is the social part. Helm is built for one learner, and the settings where learning is most social, a team, a cohort, a firm's associates, would need the map to be shareable.

## 4. Design decisions and trade-offs

Each of the following is a feature as it exists, the reason it exists that way, and what it costs.

**Harvest reads only the learner's words, and the check is mechanical.** Knowledge shows up in how people phrase requests, constraints, and corrections; the assistant's reply is not evidence about the learner. A quote that can't be found in the learner's message is discarded along with the confidence estimate that leaned on it. The cost is that paraphrased evidence is thrown out too, so confidence stays "unknown" more often than a looser rule would allow. That is the right side to err on.

**"Keep delegating" is a first-class answer.** Most ideas that surface aren't worth understanding, and a learning tool that implies otherwise becomes a source of guilt. Delegated ideas stay on the map, dimmed, and still count toward co-occurrence, but never trigger an offer.

**The active set is small and sticky.** Three ideas, held for weeks; Prune proposes at most one swap and only when a challenger clearly dominates. Durability needs persistence, and my own interests are capacious enough that a set which followed them week to week would never let anything settle. The cost is slowness to follow a new interest; the curiosity pin, which protects one idea from the ranking, is the release valve.

**The map is the primary learning surface, not a chart.** Pruning happens on it, recognitions light it up, and the states are encoded in shape as well as color. It was the riskiest part of the build and had a list as its fallback; it earned its place because it makes the loop visible in a way a list can't.

**Two practice modes.** Integrated practice (through the work) and dedicated practice (set aside) do different things: the first supplies raw experience, the second lets you name and extend the abstractions in it. Without the second, nothing gets consolidated; without the first, the abstractions don't hold. The product needs the oscillation between them, so it has both, and the names, Beat and Studio, are deliberately a little corny. A mode switch has to lower the productivity pressure the moment it appears, and a name that makes you smile does that faster than one that sounds like a feature.

**Offers are ranked by how much they can be trusted, and the long-task wait comes first.** When I kick off long-running work I look for something to fill the wait, usually another task or a distraction. An offer to go deeper on the very thing the agent is doing, at that moment, costs nothing and is the most situated material available. Below it: the learner's own why-questions, natural pause points, and the scheduled block. The cost of any trigger is that a badly timed offer is an interruption, so nothing fires mid-flow and every dismissal is remembered.

**Studio runs on a rung the learner can move, and closes with one sentence.** Modeling, coaching, and fading are an explicit fading schedule; the learner drops or raises the rung at will. The closing question, "what would you now specify differently in a prompt about this kind of work?", is the product's definition of success in miniature: the measure of practice is steering, not doing it by hand. That sentence is also what Recognize will later look for.

**Recognize proposes, and rejections are routed.** A recognition quotes the learner's words and explains the evidence; it is information, not a reward. Each rejection reason goes somewhere: "I copied a pattern" is the strongest possible signal that the idea needs practice, "I already knew this" corrects the model, "that's not the idea" fixes the rubric. The cost is model dependence, addressed by proposing rarely and asking.

**The journal feeds the prompts.** Notes on an idea are read by Studio and weighed by Prune, so writing down what you think changes what Claude does with you. This came from using the product rather than designing it.

**Onboarding is the product.** The first draft was a static "how it works" page. It became a scripted walkthrough on the real app that advances only when the real thing happens, because teaching mechanics through use applies to Helm's own onboarding.

**What was cut.** Time tracking became a single "learning budget" number; a scheduler became a calendar strip, which points at the belief that a knowledge worker's calendar is where psychological safety for learning would actually be created; a memory system became a JSON blob behind a storage interface. Integration with an existing Claude product was deliberately deferred in favor of building the concept where it was cheapest to build.

## 5. Agency

The rule throughout is *Claude observes and proposes; you judge.* Claude coined the phrase during the design conversation; I kept it because it matched what I already believed. A model can process written language at a speed and capacity I can't. What I can do is judge whether an observation or a proposal matches my experience and my motivations.

The rule is real in specific places. Harvest records nothing hidden and puts a correction next to every estimate. Prune changes nothing until accepted. Recognize asks rather than asserts, and a "no" is treated as information. The Studio rung and the closing sentence are the learner's. Notes change Claude's behavior.

It is weaker elsewhere. Helm decides what counts as an idea and how to name it; the learner can correct confidence but not the carving-up. Trigger moments are the product's, and a quiet interruption is still an interruption. A recognition confirmed out of politeness teaches the wrong thing. And the whole system is a dyad, with no one else in the loop to disagree with either party.

## 6. Learning principles

One tension shaped the product more than any other: learning integrated with the work versus learning set aside from it. Self-determination theory cuts across both. The learner has to be the one choosing when to step out, or the stepping out becomes one more thing being done to them.

Helm interleaves the two. Studio is the set-aside time, and I value that kind of time, learning something abstract for its own sake. But it works on the learner's own past exchange, so the abstraction is anchored in experience, and the learner then returns to the work and sees the principle in use. That is the transfer moment, and Recognize exists to catch it. Harvest is the other half: it notices what the work is teaching while the learner is too busy to notice.

The specific mechanisms, each with its tension: **self-determination theory** (Deci & Ryan): autonomy through picking, pinning, delegating, and moving the rung; competence shown as evidence, never reward; and because surveillance undermines intrinsic motivation and Harvest is surveillance, it reads only the learner's words and hides nothing. **Scaffolding with fading** (Wood, Bruner & Ross; van de Pol et al.): the rung ladder is the explicit fading schedule most tools omit; "let me try" exists because of the expertise-reversal effect. **Situated learning** (Lave & Wenger; Brown, Collins & Duguid): the learner's own exchanges as material and the long-task wait as the most situated moment; Studio does decontextualize, and real material is the mitigation. **Retrieval, spacing, and generation** (Roediger & Karpicke; Bjork): recognition is retrieval in the wild, graduation requires confirmations spread over weeks, and working by hand in Studio is generation. **Interleaving**: a few ideas held for weeks, alternating with the work.

## 7. Process, and how I used Claude

**Timeline.** One evening of design conversation, from a rough notion to a build plan I argued with. An overnight build by Claude Code, one model orchestrating and Opus 5.5 subagents implementing panels against contracts I'd approved. A morning of review rounds, each of which changed the product. Then this document.

**Method.** The concept was made in a loop between my hand and my voice. I handwrote impressions, beliefs, and intentions; dictated them into Claude Code, rambling included; read the organized interpretation that came back; wrote reactions in the margins; and dictated again. Each pass processed the same material in a different mode. Handwriting was where I found out what I thought, dictation was cheap enough that I never edited myself, and reading the reflection was where I could see my own thinking clearly enough to disagree with it.

It took me a while to notice that this is Helm's loop. The notes are the harvest; the reflection is the proposal, offered rather than imposed; the reactions are the judgment; the next round is the practice. And reading my own reframe back and finding it better than what I'd said aloud, in my own words, is the recognition. I didn't set out to build the tool I was using to design it.

**Technical choices.** I was deliberately hands-off. The risk was spending the day on integration with an existing Claude product instead of on the idea, so I chose the medium that gets out of the way, the web, where deployment is solved and Claude gets things right the first time. Integration became the voiceover in section 9.

**Verification.** The prototype has an end-to-end suite that walks every step of the loop with the Claude routes mocked, and each change was also exercised live against the real model before deploying. Both mattered. The suite caught regressions in the interface; the live runs caught the places where the model didn't do what the prompt asked, which is where three of the five judgment moments below came from.

**Where my judgment changed the product.** Five moments, findable in the transcripts by the quoted phrase.

1. *Steering over owning.* Claude's first framing was "skills you're renting from Claude," to be owned eventually. I pushed back: I'll keep delegating, and I should; what I want is the capacity to steer. That changed what Harvest measures, what Studio aims at, and what Recognize looks for.
2. *Beat and Studio.* Claude offered "Aside" and "Block," accurate and cold. I took the corny names on purpose.
3. *"From what you wrote."* I opened a chip and the quoted evidence was Claude's reply, not Maya's message. Rather than adjust the prompt and hope, I had the rule made mechanical. The same check dropped eighteen quotes from the seeds.
4. *Success misread as irrelevance.* The first seeded proposal wanted to swap out composite index design because Maya had gotten good at it; her high confidence had pushed it off the candidate list Claude was shown. A nearly mastered idea is a graduation, not a swap. The active set is now always in front of the model.
5. *The walkthrough.* Claude built a static "How Helm works" page. I asked for a scripted walkthrough inside the product instead.

Smaller ones followed the same pattern, among them pinning seaman status in Eli's seed so his story would exist, and discovering that Opus 5.5's thinking was consuming Studio's token budget and truncating replies. Claude proposed; I judged.

## 8. Measuring success

Not throughput; the product exists to relieve that pressure. Leading indicators, all observable in the product: recognitions confirmed per week and the confirmed-to-rejected ratio, which is the precision of the learner model, with the rejection reasons saying which way it errs; offers taken when made, by trigger; Studio sessions closed with a statement rather than abandoned; the language gap between early and late prompts on an active idea; notes written. The one to watch hardest is Beat offers dismissed: a rising rate is the earliest sign the product has become another thing nagging you. Lagging: ideas graduating to durable and staying there, and whether learners report that the time felt safe to spend.

## 9. Scaling, and where this lives in Claude products

**From the browser to a database.** The prototype keeps the whole learner state in the browser, one key per persona, because that gives every reviewer a private sandbox with nothing to provision. Everything that reads or writes state goes through a `Store` interface with three responsibilities: hand back the state, apply a pure transition and persist the result, and expose the concept index. The browser implementation is fifty lines; a Postgres implementation is the same three methods against one row per learner, JSONB for the state or normalized tables for concepts, exchanges, and events if the map needs querying. The pipeline doesn't change, and neither do the prompts, because both were written against the projection rather than the store. Seeds carry a content hash as their version so a stale client replaces itself; the same mechanism would handle schema migrations.

**Session N+1.** In production the learner model is one row per person, fed by every Claude surface. Harvest and Recognize run online per exchange against a compact projection of that row, the concept index, a few thousand cacheable tokens; decay, graduation, consolidation, and Prune run nightly through the Batch API. Per-exchange cost is bounded by the exchange and the index, not by history, and the index is capped by pruning and dormancy. Nothing re-reads the transcript except point lookups for evidence and Studio material.

**Cost.** Per active learner per working day: ten to forty exchanges, each a Sonnet harvest and a Sonnet recognize on a cached system prompt, a cent or two in total; a Beat or a Studio session on Opus when taken, a few cents each; the nightly batch at half price. Tens of cents per learner per day, dominated by the sessions the learner chose to have.

**Privacy.** The model keeps concept names, short evidence quotes from the learner's own words, notes the learner wrote, and whatever transcript retention the host product already has. Harvest reads nothing the learner can't see. Deleting an idea deletes its evidence; delegating one ends its offers.

**Three landing spots.** **Claude Code** already knows, through hooks, when an exchange lands and when a long agent run starts, which makes Harvest a hook and the long-task trigger a real signal. **Claude.ai projects** are a natural Studio surface, with the project's own conversations as material. The **desktop app's notifications** are where an offer or a recognition would arrive without interrupting anything. The map and journal would be the cross-surface view: the same row, wherever you are.

## 10. Limitations

Recognition depends on the model's reading of the learner's wording; it proposes rarely and asks, but a confirmed false positive teaches the wrong thing, and the one-per-day spacing rule is a guess. The seeds are synthetic and the maritime law is illustrative. The calendar is a strip, state lives in the browser, and Beat and Studio replies take ten to fifteen seconds to start. And Helm is a dyad: the obvious next step from the learning literature is other people, a community of practice around the map, and the design has no answer for that yet.
