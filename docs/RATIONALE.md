# Helm — design rationale

*Claude does the work. You keep the understanding.*

Prototype: https://educationlabstakehome.vercel.app · Code: https://github.com/aguydane/education_labs_takehome · The walkthrough opens on first visit and can be restarted from the header, as either seeded person.

## 1. The problem I chose

Option B: learning through collaboration with Claude. It's a need I feel in my own work.

What I liked about engineering before AI assistance was how integrated learning was with the day-to-day. You got deep into computer science principles because you needed them for the problem in front of you; I couldn't code something I didn't understand. That rigor drew me to the field, and if I'm not intentional now, it's the thing I lose. The work still gets done, faster than ever, but the understanding doesn't have to come along.

So: how do I keep developing mastery while I'm in an accelerated loop with an AI assistant, producing wondrous things at speed? Not by slowing down, and not by refusing to delegate; the models will apply most skills faster and more capaciously than I will. What my own understanding buys me is **steering capacity**: richer and more precise intentions, a sharper eye for whether an output is going where I meant, the imagination to cross into adjacent territory. Understanding deep enough to specify, judge, and redirect.

Two things follow, and they became the product's two halves. It needs affordances that say it's okay to learn right now, to step back from the wheel of productivity; over the long run productivity probably rises once it feels safe to go deep. That half is Beat and Studio. And it needs to remind you that even mid-sprint with an agent, learning is already occurring through the act of doing. That half is Harvest and Recognize, whose job is to *notice* learning that's already happening and hand it back to you.

## 2. What I built

Helm is a web app (Next.js on Vercel, Claude API on the server) that runs a four-step loop alongside ordinary work with Claude. It ships with two seeded people, Maya, a backend engineer, and Eli, a maritime defense associate working Dutch Harbor files, each with three weeks of history, and its onboarding is a scripted walkthrough on the real app rather than a tutorial.

*[Figure: the loop. Figure: the map, with the legend.]*

**Harvest.** After every exchange, a background call asks what conceptual knowledge a person would need to have produced it, and how confident we can be, from the learner's own words only, that they have it. It never interrupts; everything it records is visible on chips under the reply, with "I know this," "I don't," and "keep delegating" one click away.

**Prune.** Claude proposes a small active set of ideas to practice, with reasoning; the learner decides, on a map that is the primary learning surface. The set is sticky: slots turn over when an idea graduates or the learner drops it, never because something newer came along. A curiosity pin protects an idea from the ranking.

**Practice.** *Beat* is a two-to-five-minute aside inside the work, offered when the learner asks why or when a piece of work wraps up. *Studio* is dedicated, calendar-blocked, state-saved time on one idea, on the learner's own past exchange, at a rung the learner can move: modeling (Claude does it and narrates), coaching (you do it, Claude asks first), fading (Claude is available, not present). Studio starts on schedule or, best of all, in the wait after the learner kicks off long-running agent work.

**Recognize.** When the learner's own prompts or critiques show an idea in use, Claude proposes a recognition, quoting their words and saying why they count. The learner confirms or rejects with a reason, and each reason routes somewhere: "I copied a pattern" is the strongest harvest signal, "I already knew this" corrects the model, "that's not the idea" fixes the rubric. Confirmations spread over weeks move an idea to durable.

The map is also a journal: notes on ideas and on the lines between them, which Studio reads and Prune weighs; Claude's speculation on why two ideas keep meeting in your work; and a history of Studio sessions you can reopen.

## 3. Design decisions and trade-offs

**The loop** is distillation: from raw experience, understand what's important, reinforce it, recognize how the learning shows up in your practice, and feed that back into what's worth learning next. I like feedback loops, and this one held up.

**Two practice modes.** I like stepping back from raw experience to name the distinct aspects I can form concepts around. But without reinforcement, abstractions are castles in the sky, which is to say castles in the sand. A product like this needs the oscillation: you're practicing; what exactly? Extend that into something abstract, then extend the abstraction through further practice. The tension isn't a problem to resolve. It's essential.

**The names.** Beat and Studio are super corny, and that's a feature. You read it, chuckle, and go "all right, okay, Claude." The mode switch has to lower the productivity pressure the moment it appears, and a name that makes you smile does that faster than one that sounds like a feature.

**The trigger.** When I kick off long-running work I notice myself looking for something to do, and I fill it with a new task or a news article. What I'd find most fulfilling is a call that says: you have no work to do on this right now, and that's fine, but stay in this mode. Stay deep. While the work runs, go deeper and understand more.

**The sticky active set.** A version of me would set interests week to week; I have capacious interests. But I also want to feel I'm materially making progress, and that takes something durable to keep coming back to: you're on the right track, stick with it. So the set stays put, Claude proposes at most one swap, and the pin is an exploratory channel alongside it.

**Steering over owning.** The most fundamental prompt I gave. The "owning" version, where the goal is to do the work by hand, is too low-level. As AI evolves we're called to act at higher levels of abstraction; execution and ownership of the work can live with AI while the definition and communication of intention live with us. The metaphor that comes to mind is politicians: in relation to AI agents we need to be conversant across a wide range of things so we can direct policy and tell good from bad, without being the bureaucrats or the subject-matter experts, but knowing enough to talk to them. That's what Harvest measures and Studio aims at: not whether you could do the work, but whether you could direct it.

**Your own words.** If we increasingly steer work by talking to AI, the way we say things points at what we know. So that's what Harvest reads, and only that; a quote lifted from Claude's reply is not evidence about you, and the check is mechanical.

**What got cut.** Nothing that hurt. Time tracking became one "learning budget" number. Memory stayed a JSON blob behind a storage interface. The scheduler became a calendar strip, which points at something I believe: a knowledge worker's calendar has a big psychological impact, and creating safety for learning through it is worth pointing at even in a strip. The knowledge graph survived, though it was the riskiest two hours of the build, because it lets you see the loop happening; it earned its place by becoming where Prune happens rather than a picture of the data. The journal came from using it: I wanted to record my own impressions of the nodes and how they connect, so we added it and made the notes matter to Studio and Prune.

## 4. Agency

The rule that runs through the product is *Claude observes and proposes; you judge.* Claude coined those words partway through the design conversation, and I kept them because they matched something I already believed. An LLM processes written language at a speed and capacity I cannot. What I can do is judge, from my own experience, whether this observation or this proposal matches my experience of the world and what my motivations actually are. Claude reads everything; I decide what it means.

Where it's real: Harvest records nothing you can't see and puts "I know this" and "I don't" next to every estimate. Prune changes nothing until you accept. Recognize proposes, never asserts, and your "no" is information. The Studio rung is yours to move, the closing sentence yours to write or skip. Your notes change what Claude does with you next time.

Where it's weak: Helm still decides what counts as an idea and how to name it; you can correct the confidence but not the carving-up. The trigger moments are the product's, and a badly timed offer is an interruption even when quiet. A recognition confirmed out of politeness teaches the wrong thing. And it's a dyad; no one else is in the loop to disagree with either of us.

## 5. Learning principles

One tension shaped the product more than anything else: learning integrated with the work (practice through doing, because you need to) versus dedicated practice (time set aside for one idea). Self-determination theory sits across both: the learner has to be the one choosing when to step out, or the stepping out becomes one more thing being done to them.

Helm interleaves the two. Studio is the dedicated time, where I get to learn something "academic" and expand my understanding of something abstract, which I personally love. But it's buttressed by actual experience: the material is my own past exchange, not a textbook example. Then I turn around and see the principle put into practice, and that's when it solidifies as a skill rather than an idea I once read. That's the transfer moment, and Recognize is built to catch it. The other half is the reminder that day-to-day work is shaping how I see the world even when I don't notice; Harvest notices what the work is teaching while I'm too busy to, and Recognize hands the evidence back.

The mechanisms, each with its tension: **self-determination theory** (Deci & Ryan): the learner picks, pins, delegates, moves the rung; progress is evidence, never a reward; and because surveillance undermines intrinsic motivation and Harvest *is* surveillance, it reads only your words and shows everything. **Scaffolding with fading** (Wood, Bruner & Ross; van de Pol et al.): the rung ladder is the explicit fading schedule most tools omit; "let me try" exists because of the expertise-reversal effect. **Situated learning** (Lave & Wenger; Brown, Collins & Duguid): your own exchanges as material, the long-task wait as the most situated moment available; Studio does decontextualize, and real material is the mitigation. **Retrieval, spacing, generation** (Roediger & Karpicke; Bjork): recognition is retrieval in the wild, graduation needs confirmations spread over weeks, doing it by hand is generation. **Interleaving**: two or three ideas held for weeks, alternating with the work.

## 6. Process, and how I used Claude

**Timeline.** One evening of design conversation, from a rough notion to a build plan I argued with. An overnight build by Claude Code, one model orchestrating and Opus 5.5 subagents implementing panels against contracts I'd approved. A morning of review rounds, each of which changed the product. Then this document, dictated.

**How the concept got made.** A loop between my hand and my voice. I handwrote impressions, beliefs, intentions; dictated them into Claude Code, rambling included; got back an organized reading of what I'd said against the whole conversation; jotted reactions in the margins; dictated again. Each pass processed the same material in a different mode. Handwriting was where I found out what I thought; dictating was cheap enough that I never edited myself; reading the reflection was where I could see my thinking clearly enough to disagree with it.

It took me a while to notice this is Helm's loop. The notes are the harvest; the reflection is the proposal, offered rather than imposed; my reactions are the judgment; the next round is the practice. And the moment I read my own reframe back and saw it was better than what I'd said out loud, in my own words, is the recognition. I didn't set out to build the tool I was using to design it, but I'm not going to pretend I mind.

**Technical choices.** Deliberately hands-off. The risk was spending the day on integration with an existing Claude product instead of on the idea, so I picked the medium that gets out of the way: the web, where deployment is solved and Claude gets things right the first time. Integration became a voiceover (section 8).

**Where my judgment changed the product.** Five moments, findable in the transcripts by the phrase in quotes.

1. *Steering over owning.* Claude's first framing was "skills you're renting from Claude," to be owned eventually. I pushed back: I'll keep delegating, and I should; what I want is the capacity to steer. That changed what Harvest measures, what Studio aims at, and what Recognize looks for.
2. *Beat and Studio.* Claude offered "Aside" and "Block," accurate and cold. I took the corny names on purpose.
3. *"From what you wrote."* I opened a chip and the quoted evidence was Claude's reply, not Maya's message. Rather than fix the prompt and hope, I had the rule made mechanical: a quote not found in the learner's message is discarded with its confidence estimate. The same check dropped eighteen quotes from the seeds.
4. *Success misread as irrelevance.* The first seeded proposal wanted to swap out composite index design because Maya had gotten good at it; her high confidence had pushed it off the list Claude was shown. A nearly mastered idea is a graduation, not a swap; the active set is now always in front of the model.
5. *The walkthrough.* Claude built a static "How Helm works" page. I asked for a scripted walkthrough inside the product, because teaching mechanics through play applies to Helm's own onboarding. It runs on the real app and advances only when the real thing has happened.

Smaller ones followed the same pattern (Eli's seed pins seaman status so his story would exist; Opus 5.5's thinking was eating Studio's token budget and truncating replies). Claude proposed; I judged.

## 7. Measuring success

Not productivity metrics; the product exists to relieve that pressure. Leading, all observable in the product: recognitions confirmed per week and the confirmed-to-rejected ratio (the precision of the learner model, with rejection reasons saying which way it's wrong); offers taken when made, by trigger; Studio sessions closed with a statement rather than abandoned; the language gap between early and late prompts on an active idea; notes written. The one I'd watch hardest is Beat offers *dismissed*: a rising rate is the earliest sign the product has become another thing nagging you. Lagging: ideas graduating to durable and staying there, and whether learners say they felt safe spending the time.

## 8. Scaling, and where this lives in Claude products

The pipeline is pure functions over a transcript store, behind a storage interface; the chat UI is one transcript source and the seed generator is another. In production the learner model is one row per person, fed by every Claude surface. Harvest and Recognize run online per exchange against a compact projection of that model (the concept index, a few thousand cacheable tokens); decay, graduation, consolidation and Prune run nightly through the Batch API. Per-exchange cost is bounded by the exchange and the index, not by history.

Three landing spots: **Claude Code** already knows, through hooks, when an exchange lands and when a long agent run starts, which makes Harvest a hook and the long-task trigger a real signal. **Claude.ai projects** are a natural Studio surface, with the project's own conversations as material. The **desktop app's notifications** are where an offer or a recognition would arrive without interrupting anything. The map and journal would be the cross-surface view: the same row, wherever you are.

## 9. Limitations, and what's next

Recognition depends on the model's judgment of the learner's wording; it proposes rarely and asks, but a confirmed false positive teaches the wrong thing, and the one-per-day spacing rule is a guess. The seeds are synthetic and the maritime law is illustrative. The calendar is a strip, state lives in the browser, and Beat and Studio replies take ten to fifteen seconds to start. And Helm is a dyad: the obvious next step from the learning literature is other people, a community of practice around the map, and the design has no answer for that yet.
