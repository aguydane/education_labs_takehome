# Helm — design rationale (draft)

> Working draft. Sections marked **[voice]** are written from Dane's dictated notes and are in his voice; the rest is scaffolding assembled from the design conversation, to be replaced the same way. Anything in [square brackets] is a gloss or suggestion from Claude, not something Dane said — keep or cut.
>
> Status: §1 Which option [voice]; §3 Design decisions [voice]; §4 Agency [voice, partial]; §5 Learning principles [voice]; §6 Process [voice, partial]. §2, §7, §8, §9 drafted from the build, for marking up.

## Which option, and why **[voice]**

Option B: learning through collaboration with Claude. I chose it because it's a need I feel in my own work.

Something I liked about engineering before AI assistance was how integrated learning was with the day-to-day. You got deep into computer science principles because you needed them to solve the problem in front of you. I couldn't code something I didn't understand. That's a large part of what attracted me to software engineering in the first place: the rigor, having to demonstrate things rigorously, having to really understand a concept in order to implement it. If I'm not intentional about it now, that's the thing I lose. The work still gets done, faster than ever, but the understanding doesn't have to come along.

So the question I wanted to explore with Option B was: how do I keep developing mastery while I'm in this accelerated loop with an AI assistant, producing genuinely wondrous things at a lot of rapidity? Not by slowing down, and not by refusing to delegate. Claude and the models after it will apply most skills faster and more capaciously than I will. What my own understanding buys me is **steering capacity**: richer and more precise intentions, a sharper eye for whether an output is going in the direction I meant, the imagination to cross into adjacent territory. Understanding deep enough to specify, judge, and redirect. Claude does the work; you keep the understanding.

Two things follow for the design. First, it needs affordances and reminders that say: it is okay to learn right now, to take a step back. You don't need to be on the wheel of productivity. In fact, over the long run, productivity probably rises as it becomes safe and acceptable to focus and go deep on learning. Second, it needs to remind you that even in the middle of an intense stretch of productivity with an AI agent, learning is already occurring through the act of doing. [Gloss: those two are the product's two halves. Beat and Studio exist for the first; Harvest and Recognize exist for the second, and their job is mostly to *notice* learning that is already happening and hand it back to you.]

## What I built

Helm is a web app (Next.js, deployed on Vercel, Claude API on the server) at https://educationlabstakehome.vercel.app. It runs the loop below on two seeded people, Maya (a backend engineer) and Eli (a maritime defense associate), each with three weeks of history, and opens with a scripted walkthrough that runs on the real app rather than a tutorial. [Figure: the loop diagram. Figure: the map with the legend.]

Four steps, run continuously alongside ordinary work.

**Harvest.** After every exchange, a background call asks: what conceptual knowledge would a person need to understand this exchange and its output well enough to have produced it, given time? And how confident can we be, from the learner's own words, that they have it? It never interrupts. Everything it records is visible on chips under each message, and "keep delegating this" is one click, because not everything is worth understanding.

**Prune.** Claude proposes a small active set with plain-language reasoning; the learner decides, on a knowledge graph that is the primary learning surface rather than a decoration. The active set is sticky by design. Slots turn over when a concept graduates or the learner drops it, never because something newer came along. Interest-based exploration lives on the graph as adjacent nodes and a "curiosity pin" that protects a concept from the ranking.

**Practice.** Two modes, because in my own experience these are two different things. *Beat* is a two-to-five-minute aside inside work, triggered by the learner's own bid ("why did you do it that way?") or at a pause point. *Studio* is dedicated, protected, calendar-blocked, state-saved time: your calendar shows the block, your colleagues see Busy, your work is summarized and saved so it's safe to leave. Studio coaches on the learner's own past exchange, on a rung the learner can move: modeling (Claude does it and narrates), coaching (you do it by hand, Claude asks before it tells), fading (Claude is available, not present). Doing it by hand is the method; steering evidence is the measure.

**Recognize.** Later, when the learner's own prompts, critiques, or session structure show a concept in use ("two weeks ago you asked me to make this query faster; today you asked for a partial index and a planner check"), Claude proposes a recognition, quoting their words. The learner confirms or rejects, and every rejection routes somewhere: "I copied a pattern" is the strongest possible harvest signal; "I already knew this" corrects the model; "that's not the concept" fixes the rubric.

The best trigger turned out to be one I know from my own days: the moment after kicking off long-horizon agent work. There is nothing to produce, the safety framing is airtight because you'd be waiting anyway, and the most situated material possible is whatever the agent is doing right now.

## Design decisions and trade-offs **[voice]**

### The loop

The general idea is distillation: from raw experience, understand what's important, reinforce what's important, then recognize how the learning is actually showing up in your practice, and let that recognition feed back into what's worth learning next. I like feedback loops. When the four steps were first named, Harvest, Prune, Practice, Recognize, it was a decent enough way to run with, and it held up.

### Two practice modes, not one

I like being able to step back and abstract away from raw experience: what are the distinct, nameable aspects here that I can form concepts and an ontology around? But without reinforcement, the abstractions are castles in the sky, and castles in the sky are really castles in the sand; they blow away. I don't think a product like this could have one mode without the other. What it needs is the integrated oscillation: you're practicing; what exactly is it you're practicing? Can we extend that implicit notion into something more abstract? Now extend the abstraction through further practice. The tension between the two isn't a problem to resolve. It's essential.

### The names

[From the design conversation, in Dane's words there: "Beat and Studio are super corny, but I think that's a feature, not a bug. It feels disarming. I can imagine reading it and chuckling a little bit and then being like, all right, okay, Claude." Suggest one more sentence on what the disarming is *for*: the mode switch has to lower the productivity pressure the moment it appears, and a name that makes you smile does that faster than a name that sounds like a feature.]

### The trigger, and why the wait comes first

That one came from lived experience. When I kick off long-running work, I notice myself looking for a distraction, or for something to do. Sometimes I fill that "productively" by having a new task at the ready; sometimes I use it for distraction, a news article, whatever. What I'd find most fulfilling is a call that says: you don't have any work to do on this task right now, and that's fine, but stay in this mode. Stay deep here. Don't go multitask somewhere else. While the work happens in the background, go deeper and understand more. Being called to that, at that moment, just felt right.

### The sticky active set

There's a version of me that would want to set interests week to week. I have a lot of capacious interests. But I also want to feel that I'm materially understanding something and making progress on it, and sometimes what that takes is an external reminder and something durable, practice-wise, that I can keep coming back to and be assured: you're on the right track, stick with it. So the set stays put on purpose, and Claude proposes at most one swap. Maybe there's room for more exploratory aspects on top of that; the curiosity pin is a start.

### Steering over owning

This was probably the most fundamental prompt I gave. The "owning" version is just too low-level. As AI evolves, we as humans are called to act at higher and higher levels of abstraction, with more and more breadth, or conversely more and more depth, and we get to use the fact that we're embodied beings. Ultimately AI should serve us, in the sense that we should be trying to make the lives of humans everywhere better through it. That can mean a lot of the execution and ownership of the actual work lives with AI, while the definition and communication of intention lives with us. Being able to steer and to form: that's the thing I want to optimize for.

The metaphor that comes to mind is that humans in relation to AI agents are becoming something like politicians. We probably need to be conversant across a wide range of things so that we can direct policy and understand what makes good or at least decent policy, without needing to be the bureaucrats or the subject-matter experts ourselves, but knowing enough to communicate with the subject-matter experts. That's what Harvest measures and what Studio aims at: not whether you could do the work, but whether you could direct it.

### What got cut, and what didn't

Nothing really hurt. The cuts were sane; we were doing a prototype. We didn't need to optimize memory storage because we weren't scaling. The scheduler and the calendar strip became a pointer to something I believe: a knowledge worker's calendar has a big psychological impact, and if a product can create psychological safety for learning through an integration with the calendar, that's worth pointing at even in a strip. The knowledge graph didn't get cut because the graphical element communicates the idea in a really nice way; you can see the loop happening. [Gloss: in the build order it was also the riskiest two hours, which is why it had a fallback to a list; it earned its place by becoming where Prune happens rather than a picture of the data.]

### Harvest judges you by your own words

This one just makes sense. If we're increasingly interacting and chatting with AI to steer and initiate work, then how we do that, the way we say things, implicitly points at what we know. Our knowledge is in our wording. So that's what Harvest reads, and only that; a quote lifted from Claude's reply is not evidence about you, and the check for that is mechanical, not a matter of prompt manners.

### The map as a journal

The idea just came to me from using it: I'd love to be able to record my own thoughts about the pieces of the map, what the nodes are, my impressions of them, how they're connected. So we just added that in. [Gloss: and then made the notes matter: Studio reads them, and Prune weighs your latest one.]

## Process **[voice, partial]**

### How the concept got made

The thing that worked best wasn't a tool feature. It was a loop between my hand and my voice.

I started by handwriting: impressions, beliefs, opinions, intentions. Not a spec; closer to a list of what I was sure of and what I wanted. Then I dictated those notes by voice into Claude Code, rambling included. What came back was a more organized representation of what I'd just said, interpreted against the whole history of the conversation so far. I read that, jotted down notes, reactions and impressions on it, and dictated again. I did this iteratively until the notion had congealed into an executable concept: something tangible enough that a product could be built around it, and refined to the point where I was confident I could hand it off to be executed and deployed as a web application.

The two halves were doing different jobs. Handwriting was where I found out what I actually thought; dictating was cheap enough that I never edited myself; and reading the organized reflection was where I could see my own thinking clearly enough to disagree with it. Several of the decisions in this document came out of me reacting to a reflection rather than out of the reflection itself. The reframe from "owning skills" to steering capacity is the clearest case; the two practice modes are another.

What I think made it rich is that each pass processed the same material in a different way. I'd see Claude's output and read it. Then I'd process it again in a more linear, note-taking format, by hand. Then I'd go back through those notes and read them, and the material would get re-understood by me, a second time, in my own arrangement. Then I'd give voice to it: rambling, free-form, maybe more intuitive than any of the written passes. And then on top of all of that, an LLM would process the language of that rambling and hand back a structured reading of it. Five passes over one idea, each in a different mode, none of them the final word. The results were richer than I'd have gotten from any one of those modes alone, and richer than I've gotten from typing at a chat window. [Gloss: this is also a small argument for why Helm reads the learner's own words rather than Claude's. The learner's rambling is where the understanding shows up; the organized version is what someone else made of it.]

It took me a while to notice that this is Helm's loop. The handwritten notes are the harvest: raw material from the work, unfiltered. The organized reflection is the proposal: Claude's read on what matters, offered rather than imposed. My reactions in the margins are the judgment, and the next round is the practice. And the moment I read my own reframe back and saw that it was better than what I'd said out loud, in my own words, is the recognition. Claude proposed; I judged; the thing that came out was mine. I didn't set out to build the tool I was using to design it, but I'm not going to pretend I mind. [Gloss: worth a beat in the video, too.]

### Technical choices: deliberately hands-off

On the technical side I was very hands-off, and that was a choice. Given the conceptual scope and depth I discovered I wanted to explore, the risk was spending the day on integration questions (how do I appropriately integrate this vision with an existing Claude product?) instead of on the idea. So I picked the medium that would get out of the way: the web. Deployability is a very well solved problem on platforms like Vercel. The expressibility of JavaScript, HTML, CSS and the modern frameworks is very high. And I'd had good success working with Claude on getting things right the first time in that stack. Lean into that, build the concept where it's cheapest to build, and treat integration as a voiceover added afterwards: these ideas could be incorporated into, say, the Claude desktop app in these specific ways.

[Suggestion: §8 Scale is where that voiceover lives; this paragraph should end by pointing there, and §8 should name the two or three concrete integration points — Claude Code hooks as the harvest source and the long-task trigger; a Claude.ai project as the Studio surface; the desktop app's notifications for Beat offers.]

### Still to come from Dane

- The timeline of the day, roughly (design conversation → build plan → overnight build → the morning's review rounds).
- Four to six **judgment moments**, each with a transcript pointer. Candidates from the conversation: the steering reframe; Beat and Studio as deliberately disarming names; pinning seaman status in Eli's seed so the story would exist; harvest quoting Claude's text as "from what you wrote" and the mechanical evidence guard that followed; Prune trying to swap out a concept *because* the learner had gotten good at it; replacing the static intro with a walkthrough that teaches through use; the Opus 5.5 `max_tokens` truncation.
- What you'd tell someone else about working this way.

## How the design enhances rather than replaces human agency **[voice, partial]**

The rule that runs through the product is *Claude observes and proposes; you judge.* I should be honest that I didn't come up with those words; Claude did, partway through the design conversation, and I kept them because they matched something I already believed. An LLM can process written language at a speed and with a capacity that I cannot. What I can do is judge, from my own human experience: does this observation, does this proposal, match my experience of the world? Does it match what my motivations actually are? That division of labor is the whole design. Claude reads everything; I decide what it means.

[Drafted from the build for Dane to mark up: where the rule is real, and where it isn't yet.]

**Where it's real.** Harvest records nothing you can't see, only ever judges you by your own words, and every estimate has an "I know this / I don't" next to it; "keep delegating" is a first-class answer, not a failure state. Prune changes nothing: the proposal sits there with its reasoning until you accept, untick, or keep the current set, and it will not swap an idea out just because a newer one arrived. Recognize proposes, never asserts: it quotes your words, says why they count, and asks; your "no" comes with a reason, and each reason goes somewhere useful instead of into a bin. In Studio, the rung is yours to move in either direction, and the closing sentence is yours to write or to skip. Your notes on an idea change what Claude does with you next time, so the journal is an input, not a diary.

**Where it's weak.** Helm still decides what counts as an idea and how to name it; you can correct the confidence but not the carving-up. The trigger moments are chosen by the product, and a badly timed offer is still an interruption even when it's quiet. Recognition depends on the model's judgment of your wording, and a false positive that you confirm out of politeness teaches the wrong thing. The curiosity pin is the only channel for interests that don't score well, and it holds one idea. And the whole thing is a dyad: there is no one else in the loop to disagree with either of us. [Dane: add or strike; the honest one here is worth more than the strong one.]

## Learning principles **[voice]**

Digging into the learning science was one of the parts of this I enjoyed most, and one tension in it ended up shaping the product more than anything else. On one side is learning that's integrated with the work: you get practice through doing the thing, in context, because you need to. On the other is dedicated practice: time set aside, on purpose, to work on one idea. Self-determination theory sits across both: the learner has to be the one choosing when to step out of the work, or the stepping out becomes one more thing being done to them.

Helm's answer is to interleave the two rather than pick one. Studio is the dedicated time. It's where I get to learn something "academic," to dedicate myself to expanding my worldview and my understanding of something a bit more abstract, and I personally love that kind of time. But it's buttressed by actual experience: the material is my own past exchange, not a textbook example. Then I get to turn around and see the more abstract principle put into practice, and that's when it solidifies for me as a skill and a tool, not just an idea I once read about.

The other half is the reminder that all the stuff I'm doing day to day is helping to shape the way I see the world, materially. I'm gaining skills even when I don't notice it moment to moment. That's where Harvest and Recognize come into play: Harvest notices what the work is teaching while I'm too busy to notice, and Recognize catches the moment the abstract principle shows up in my own wording and hands it back to me as evidence.

[Gloss: the thing you're describing in the second paragraph, an abstract principle learned in set-aside time and then seen in practice, is the transfer moment, and Recognize is built specifically to catch it. And the love of "academic" time is the safety thesis in miniature: the product exists to make that time feel legitimate inside a working day.]

[Claude's mapping to the literature, for the reader who wants the citations. Trim to what you'd defend in an interview.]

- **Self-determination theory** (Deci & Ryan). Autonomy: the learner picks, pins, delegates, moves the rung. Competence: evidence of progress is shown and is informational, never a reward. The uncomfortable finding: surveillance and controlling rewards undermine intrinsic motivation, and Harvest *is* surveillance. So it reads only the learner's own words, shows everything it records, and "keep delegating" is one click.
- **Scaffolding with fading** (Wood, Bruner & Ross; van de Pol et al.). The rung ladder, modeling → coaching → fading, is the explicit fading schedule the research says most tools leave out. "Let me try" exists because of the expertise-reversal effect: guidance that helps a novice slows an expert.
- **Situated learning** (Lave & Wenger; Brown, Collins & Duguid). Practice on the learner's own exchanges; the long-task wait as the most situated moment available. Studio does decontextualize, and working on real material is the mitigation. The honest limit: Helm is a dyad, with no community of practice.
- **Retrieval, spacing, generation** (Roediger & Karpicke; Bjork). Recognition is retrieval in the wild. Graduation needs confirmations spread over weeks. Doing it by hand in Studio is the generation effect.
- **Interleaving vs. blocked practice.** Two or three active ideas held for weeks, alternating with the work, with a curiosity pin as the exploration channel that doesn't compete for the slots.

## Measuring success

Not productivity metrics; the product exists to relieve that pressure, and measuring it by throughput would undo the point. The measures are about whether learning is happening and whether it feels safe.

Leading indicators, all observable inside the product: recognitions confirmed per week, and the ratio of confirmed to rejected (that ratio is the precision of the learner model, and the rejection reasons say which way it's wrong); the share of Beat and Studio offers taken when made, by trigger, which tells you whether the moments are right; Studio sessions closed with a statement rather than abandoned; the language gap between a learner's early and late prompts on an active idea, which is what Recognize is measuring one message at a time; and notes written, because a journal that gets written in is a map that's being used.

Lagging: ideas graduating to durable, and how long they stay there; whether learners report, when asked, that they felt safe spending the time. [Gloss: the one I'd watch hardest is Beat offers *dismissed*, because a rising dismissal rate is the earliest sign the product has become another thing nagging you.]

## Scaling

The pipeline is a set of pure functions over a transcript store, behind a storage interface; the chat UI is one transcript source and the seed generator is another. In production the learner model is one row per person, fed by every Claude surface, with Harvest and Recognize running online per exchange against a compact projection of that model (the concept index, a few thousand cacheable tokens), and decay, graduation, consolidation and Prune running nightly through the Batch API. Per-exchange cost is bounded by the exchange and the index, not by history; the index is capped by pruning and dormancy. Surfaces have two jobs only: post exchanges, and render offers and recognitions while accepting judgments. Section 3.1 of the build plan walks through session N+1 against a durable store.

This is also where the "integration as a voiceover" from the Process section lands. Three concrete places these ideas fit existing Claude products: **Claude Code**, where hooks already know when an exchange lands and when a long agent run starts, which makes Harvest a hook and the long-task trigger a real signal instead of a simulated button; **Claude.ai projects**, which are a natural Studio surface, with the project's own past conversations as the material; and the **desktop app's notifications**, which are where a Beat offer or a recognition would arrive without interrupting anything. The map and the journal would be the cross-surface view: the same row, rendered wherever you are.

## Limitations, and what's next

Recognition depends on the model's judgment of the learner's wording; it's tuned to propose rarely and to ask, but a confirmed false positive teaches the wrong thing, and the current spacing rule (one recognition per idea per day) is a guess. The seeds are synthetic, so the personas' three weeks of history are plausible rather than real, and the maritime law is illustrative. The calendar is a strip, not a calendar. State lives in the browser. Beat and Studio replies take ten to fifteen seconds to start. And Helm is a dyad: the most obvious next step from the learning literature is other people, a community of practice around the map, and the design has no answer for that yet.
