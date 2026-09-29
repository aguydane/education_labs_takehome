# Helm — design rationale

*Claude does the work. You keep the understanding.*

Prototype: https://educationlabstakehome.vercel.app · Code: https://github.com/aguydane/education_labs_takehome · The walkthrough opens on first visit and can be restarted from the header, as either of the two seeded people.

## 1. The problem I chose

Option B: learning through collaboration with Claude. I chose it because it's a need I feel in my own work.

Something I liked about engineering before AI assistance was how integrated learning was with the day-to-day. You got deep into computer science principles because you needed them to solve the problem in front of you. I couldn't code something I didn't understand. That rigor, having to really understand a concept in order to implement it, is a large part of what attracted me to the field. If I'm not intentional about it now, that's the thing I lose. The work still gets done, faster than ever, but the understanding doesn't have to come along.

So the question I wanted to explore was: how do I keep developing mastery while I'm in this accelerated loop with an AI assistant, producing genuinely wondrous things at a lot of rapidity? Not by slowing down, and not by refusing to delegate; Claude and the models after it will apply most skills faster and more capaciously than I will. What my own understanding buys me is **steering capacity**: richer and more precise intentions, a sharper eye for whether an output is going where I meant, the imagination to cross into adjacent territory. Understanding deep enough to specify, judge, and redirect.

Two things follow for the design, and they turned out to be its two halves. First, it needs affordances and reminders that say: it is okay to learn right now, to take a step back. You don't need to be on the wheel of productivity, and over the long run productivity probably rises as it becomes safe to focus and go deep. That half is Beat and Studio. Second, it needs to remind you that even in the middle of an intense stretch of work with an AI agent, learning is already occurring through the act of doing. That half is Harvest and Recognize, whose job is mostly to *notice* learning that's already happening and hand it back to you.

## 2. What I built

Helm is a web app (Next.js on Vercel, Claude API on the server) that runs a four-step loop alongside ordinary work with Claude. It ships with two seeded people, Maya, a backend engineer, and Eli, a maritime defense associate working Dutch Harbor files, each with three weeks of history, and its onboarding is a scripted walkthrough on the real app rather than a tutorial.

*[Figure: the loop. Figure: the map, with the legend.]*

**Harvest.** After every exchange, a background call asks what conceptual knowledge a person would need to understand this exchange and its output well enough to have produced it, and how confident we can be, from the learner's own words only, that they have it. It never interrupts. Everything it records is visible on chips under each reply, with "I know this," "I don't," and "keep delegating" one click away, because not everything is worth understanding.

**Prune.** Claude proposes a small active set of ideas to practice, with plain-language reasoning; the learner decides, on a map that is the primary learning surface rather than a decoration. The set is sticky by design: slots turn over when an idea graduates or the learner drops it, never because something newer came along. A curiosity pin protects an idea from the ranking.

**Practice.** Two modes. *Beat* is a two-to-five-minute aside inside the work, offered when the learner asks why or when a piece of work wraps up. *Studio* is dedicated, calendar-blocked, state-saved time on one idea, using the learner's own past exchange as the material, on a rung the learner can move: modeling (Claude does it and narrates), coaching (you do it, Claude asks before it tells), fading (Claude is available, not present). Studio starts on schedule or, best of all, in the wait after the learner kicks off long-running agent work.

**Recognize.** When the learner's own prompts or critiques show an idea in use, Claude proposes a recognition, quoting their words and saying why they count. The learner confirms or rejects with a reason, and each reason routes somewhere: "I copied a pattern" is the strongest possible harvest signal, "I already knew this" corrects the model, "that's not the idea" fixes the rubric. Confirmations spread over weeks move an idea to durable.

The map is also a journal: notes on ideas and on the lines between them, which Studio reads and Prune weighs; Claude's short speculation on why two ideas keep meeting in your work; and a history of Studio sessions you can reopen.

## 3. Design decisions and trade-offs

**The loop.** The general idea is distillation: from raw experience, understand what's important, reinforce it, then recognize how the learning is actually showing up in your practice, and let that feed back into what's worth learning next. I like feedback loops. When the four steps were first named it was a decent enough way to run with, and it held up.

**Two practice modes, not one.** I like being able to step back and abstract away from raw experience: what are the distinct, nameable aspects here that I can form concepts and an ontology around? But without reinforcement, the abstractions are castles in the sky, which is to say castles in the sand; they blow away. A product like this can't have one mode without the other. What it needs is the integrated oscillation: you're practicing; what exactly is it you're practicing? Can we extend that implicit notion into something more abstract? Now extend the abstraction through further practice. The tension between the two isn't a problem to resolve. It's essential.

**The names.** Beat and Studio are super corny, and that's a feature. It feels disarming. I can imagine reading it, chuckling a little, and going: all right, okay, Claude. The mode switch has to lower the productivity pressure the moment it appears, and a name that makes you smile does that faster than a name that sounds like a feature.

**The trigger, and why the wait comes first.** This came from lived experience. When I kick off long-running work, I notice myself looking for a distraction, or for something to do. Sometimes I fill that "productively" by having a new task at the ready; sometimes I use it for distraction, a news article, whatever. What I'd find most fulfilling is a call that says: you don't have any work to do on this right now, and that's fine, but stay in this mode. Stay deep here. Don't go multitask somewhere else. While the work happens in the background, go deeper and understand more. Being called to that, at that moment, just felt right.

**The sticky active set.** There's a version of me that would want to set interests week to week; I have a lot of capacious interests. But I also want to feel that I'm materially understanding something and making progress on it, and sometimes what that takes is an external reminder and something durable that I can keep coming back to and be assured: you're on the right track, stick with it. So the set stays put on purpose and Claude proposes at most one swap. The curiosity pin is the start of an exploratory channel alongside it.

**Steering over owning.** This was probably the most fundamental prompt I gave. The "owning" version, where the goal is to be able to do the work by hand, is just too low-level. As AI evolves, we as humans are called to act at higher and higher levels of abstraction, with more breadth or, conversely, more depth, and we get to use the fact that we're embodied beings. Ultimately AI should serve us, in the sense that we should be trying to make the lives of humans everywhere better through it. That can mean a lot of the execution and ownership of the actual work lives with AI, while the definition and communication of intention lives with us. Being able to steer and to form is the thing I want to optimize for.

The metaphor that comes to mind is that humans in relation to AI agents are becoming something like politicians. We need to be conversant across a wide range of things so that we can direct policy and understand what makes good, or at least decent, policy, without being the bureaucrats or the subject-matter experts ourselves, but knowing enough to communicate with them. That's what Harvest measures and what Studio aims at: not whether you could do the work, but whether you could direct it.

**Harvest judges you by your own words.** If we're increasingly chatting with AI to steer and initiate work, then how we do that, the way we say things, implicitly points at what we know. Our knowledge is in our wording. So that's what Harvest reads, and only that. A quote lifted from Claude's reply is not evidence about you, and the check for that is mechanical, not a matter of prompt manners.

**What got cut, and what didn't.** Nothing really hurt; the cuts were sane for a prototype. Time tracking became a single "learning budget" number. Memory storage stayed a JSON blob behind a storage interface, because we weren't scaling. The scheduler became a calendar strip, which is a pointer to something I believe: a knowledge worker's calendar has a big psychological impact, and if a product can create psychological safety for learning through the calendar, that's worth pointing at even in a strip. The knowledge graph didn't get cut, even though it was the riskiest two hours of the build, because the graphical element communicates the idea in a really nice way; you can see the loop happening. It earned its place by becoming where Prune happens rather than a picture of the data.

**The map as a journal.** This one came from using it: I wanted to record my own thoughts about the pieces of the map, what the nodes are, my impressions of them, how they're connected. So we added it, and then made the notes matter, so that Studio reads them and Prune weighs the latest one.

## 4. How the design enhances rather than replaces human agency

The rule that runs through the product is *Claude observes and proposes; you judge.* I should be honest that I didn't come up with those words; Claude did, partway through the design conversation, and I kept them because they matched something I already believed. An LLM can process written language at a speed and capacity that I cannot. What I can do is judge, from my own human experience: does this observation, this proposal, match my experience of the world and what my motivations actually are? That division of labor is the whole design. Claude reads everything; I decide what it means.

Where it's real: Harvest records nothing you can't see, judges you only by your own words, and puts "I know this" and "I don't" next to every estimate. Prune changes nothing until you accept. Recognize proposes, never asserts, and your "no" is information. In Studio the rung is yours to move in either direction, and the closing sentence is yours to write or skip. Your notes change what Claude does with you next time; the journal is an input, not a diary.

Where it's weak: Helm still decides what counts as an idea and how to name it; you can correct the confidence but not the carving-up. The trigger moments are chosen by the product, and a badly timed offer is an interruption even when it's quiet. A recognition you confirm out of politeness teaches the wrong thing. The curiosity pin holds one idea. And the whole thing is a dyad; there is no one else in the loop to disagree with either of us.

## 5. Learning principles

Digging into the learning science was one of the parts of this I enjoyed most, and one tension in it shaped the product more than anything else. On one side is learning integrated with the work: practice through doing the thing, in context, because you need to. On the other is dedicated practice: time set aside, on purpose, to work on one idea. Self-determination theory sits across both. The learner has to be the one choosing when to step out of the work, or the stepping out becomes one more thing being done to them.

Helm's answer is to interleave the two rather than pick one. Studio is the dedicated time. It's where I get to learn something "academic," to expand my worldview and my understanding of something a bit more abstract, and I personally love that kind of time. But it's buttressed by actual experience: the material is my own past exchange, not a textbook example. Then I get to turn around and see the abstract principle put into practice, and that's when it solidifies for me as a skill and a tool rather than an idea I once read about. That moment is the transfer moment, and Recognize is built to catch it.

The other half is the reminder that all the stuff I'm doing day to day is shaping the way I see the world, materially. I'm gaining skills even when I don't notice it moment to moment. That's where Harvest and Recognize come in: Harvest notices what the work is teaching while I'm too busy to notice, and Recognize catches the moment the principle shows up in my own wording and hands it back to me as evidence.

The specific mechanisms, with the tension each one carries:

- **Self-determination theory** (Deci & Ryan). Autonomy: the learner picks, pins, delegates, moves the rung. Competence: progress is shown as evidence, never as a reward. The uncomfortable finding is that surveillance undermines intrinsic motivation, and Harvest *is* surveillance; so it reads only the learner's words, shows everything it records, and "keep delegating" is one click.
- **Scaffolding with fading** (Wood, Bruner & Ross; van de Pol et al.). The rung ladder is the explicit fading schedule the research says most tools leave out. "Let me try" exists because of the expertise-reversal effect.
- **Situated learning** (Lave & Wenger; Brown, Collins & Duguid). Practice on the learner's own exchanges; the long-task wait as the most situated moment available. Studio does decontextualize; real material is the mitigation.
- **Retrieval, spacing, generation** (Roediger & Karpicke; Bjork). Recognition is retrieval in the wild; graduation needs confirmations spread over weeks; doing it by hand in Studio is generation.
- **Interleaving.** Two or three active ideas held for weeks, alternating with the work, with the pin as an exploration channel that doesn't compete for the slots.

## 6. Process, and how I used Claude

**Timeline.** One evening of design conversation, from a rough notion to a build plan I argued with. An overnight build by Claude Code, with one model orchestrating and Opus 5.5 subagents implementing the panels against contracts I'd approved. A morning of review rounds, each of which changed the product (below). Then this document, dictated section by section.

**How the concept got made.** The thing that worked best wasn't a tool feature. It was a loop between my hand and my voice. I started by handwriting: impressions, beliefs, opinions, intentions. Not a spec; closer to a list of what I was sure of and what I wanted. Then I dictated those notes by voice into Claude Code, rambling included. What came back was a more organized representation of what I'd just said, interpreted against the whole history of the conversation. I read that, jotted notes and reactions on it, and dictated again, until the notion had congealed into an executable concept, refined to the point where I was confident I could hand it off to be built and deployed.

What made it rich is that each pass processed the same material in a different mode: reading Claude's output; re-processing it by hand in linear notes; re-reading those notes and having the material re-understood, in my own arrangement; giving voice to it, rambling and free-form and more intuitive than any written pass; and then an LLM processing the language of that rambling and handing back a structured reading. Five passes over one idea, none of them the final word. Handwriting was where I found out what I actually thought; dictating was cheap enough that I never edited myself; reading the reflection was where I could see my own thinking clearly enough to disagree with it. Several decisions in this document came out of me reacting to a reflection rather than out of the reflection itself.

It took me a while to notice that this is Helm's loop. The handwritten notes are the harvest: raw material from the work, unfiltered. The organized reflection is the proposal, offered rather than imposed. My reactions in the margins are the judgment, and the next round is the practice. And the moment I read my own reframe back and saw that it was better than what I'd said out loud, in my own words, is the recognition. Claude proposed; I judged; the thing that came out was mine. I didn't set out to build the tool I was using to design it, but I'm not going to pretend I mind.

**Technical choices: deliberately hands-off.** On the technical side I was very hands-off, and that was a choice. Given the conceptual depth I discovered I wanted to explore, the risk was spending the day on how to integrate the vision with an existing Claude product instead of on the idea. So I picked the medium that gets out of the way: the web. Deployability is a solved problem on platforms like Vercel, the expressibility of the modern web stack is very high, and I'd had good success getting things right the first time with Claude there. Build the concept where it's cheapest to build, and treat integration as a voiceover added afterwards (section 8).

**Where my judgment changed the product.** Five moments, each findable in the transcripts by the phrase in quotes.

1. *Steering over owning.* Claude's first framing was "skills you're renting from Claude," with the goal of eventually owning them. I pushed back: I'll keep delegating, and I should; what I want is the capacity to steer. That one correction changed what Harvest measures, what Studio aims at, and what Recognize looks for.
2. *Beat and Studio.* Claude offered "Aside" and "Block," which were accurate and cold. I took the corny names on purpose; disarming was the point.
3. *"From what you wrote."* On the first morning I opened a chip and the quoted evidence was Claude's own reply, not Maya's message. Rather than fix the prompt and hope, I had the rule made mechanical: a quote not found in the learner's message is discarded, along with the confidence estimate that leaned on it. Running that check over the seeds dropped eighteen quotes.
4. *Success misread as irrelevance.* The first seeded proposal wanted to swap out composite index design because Maya had gotten good at it: her high confidence had pushed it out of the candidate list Claude was shown. An active idea you've nearly mastered is a graduation, not a swap. The active set is now always in front of the model, and the prompt says so.
5. *The walkthrough.* Claude built a static "How Helm works" page. I asked for the onboarding to be an interactive, scripted walkthrough embedded in the product itself, because the assignment's own framing, teaching mechanics through play, applies to Helm's onboarding too. It now runs on the real app, as either seeded person, and advances only when the real thing has happened.

There were smaller ones (Eli's seed pins seaman status so his story would exist; Opus 5.5's thinking was eating the Studio token budget and cutting replies off mid-sentence), and the pattern across all of them is the same: Claude proposed, I judged.

## 7. Measuring success

Not productivity metrics; the product exists to relieve that pressure, and measuring it by throughput would undo the point.

Leading indicators, all observable inside the product: recognitions confirmed per week, and the ratio of confirmed to rejected, which is the precision of the learner model, with the rejection reasons saying which way it's wrong; the share of Beat and Studio offers taken when made, by trigger, which says whether the moments are right; Studio sessions closed with a statement rather than abandoned; the language gap between a learner's early and late prompts on an active idea; and notes written, because a journal that gets written in is a map being used. The one I'd watch hardest is Beat offers *dismissed*: a rising dismissal rate is the earliest sign the product has become another thing nagging you.

Lagging: ideas graduating to durable and staying there, and whether learners report, when asked, that they felt safe spending the time.

## 8. Scaling, and where this lives in Claude products

The pipeline is a set of pure functions over a transcript store, behind a storage interface; the chat UI is one transcript source and the seed generator is another. In production the learner model is one row per person, fed by every Claude surface. Harvest and Recognize run online per exchange against a compact projection of that model (the concept index, a few thousand cacheable tokens); decay, graduation, consolidation and Prune run nightly through the Batch API. Per-exchange cost is bounded by the exchange and the index, not by history, and the index is capped by pruning and dormancy. Surfaces have two jobs: post exchanges, and render offers and recognitions while accepting judgments. The build plan walks through session N+1 against a durable store.

This is also where the integration voiceover lands. **Claude Code** already knows, through hooks, when an exchange lands and when a long agent run starts; that makes Harvest a hook and the long-task trigger a real signal instead of a simulated button. **Claude.ai projects** are a natural Studio surface, with the project's own past conversations as the material. The **desktop app's notifications** are where a Beat offer or a recognition would arrive without interrupting anything. The map and the journal would be the cross-surface view: the same row, rendered wherever you are.

## 9. Limitations, and what's next

Recognition depends on the model's judgment of the learner's wording; it's tuned to propose rarely and to ask, but a confirmed false positive teaches the wrong thing, and the one-per-day spacing rule is a guess. The seeds are synthetic, so the three weeks of history are plausible rather than real, and the maritime law is illustrative. The calendar is a strip. State lives in the browser. Beat and Studio replies take ten to fifteen seconds to start. And Helm is a dyad: the most obvious next step from the learning literature is other people, a community of practice around the map, and the design has no answer for that yet.
