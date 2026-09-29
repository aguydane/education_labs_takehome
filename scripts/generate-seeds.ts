/**
 * Seed generator.
 *
 * Reads the synthetic work transcripts in seeds/transcripts/<persona>.json,
 * replays them through the REAL pipeline (harvest → prune → recognize) in
 * chronological order, adds one past Studio session, and writes
 * seeds/<persona>.json. The seed is what the system produces, not
 * hand-written output.
 *
 *   npx tsx scripts/generate-seeds.ts                 # both personas
 *   npx tsx scripts/generate-seeds.ts maritime        # one persona
 *   npx tsx scripts/generate-seeds.ts backend --reprune   # redo only the final proposal
 *   npx tsx scripts/generate-seeds.ts --fill-studio       # give seeded Studio sessions a real thread
 *   npx tsx scripts/generate-seeds.ts --clean-evidence    # drop quotes that aren't the learner's words
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { PERSONAS, PERSONA_IDS } from "@/lib/personas";
import { quoteIsFrom } from "@/lib/pipeline/evidence";
import { applyHarvest, toHarvestResult } from "@/lib/pipeline/harvest";
import { endStudio, pickMaterial, startStudio } from "@/lib/pipeline/practice";
import { applyProposal, pinConcept, setActiveSet, toProposal } from "@/lib/pipeline/prune";
import { activeConceptsOf, applyRecognizeResult, judgeRecognition } from "@/lib/pipeline/recognize";
import { createInitialState } from "@/lib/state";
import { MemoryStore } from "@/lib/store/memory";
import type { Exchange, LearnerState, PersonaId, StudioMessage } from "@/lib/types";

const SCHEMA_VERSION = "seed-schema-1";
/** Prune (and choose the first active set) after this many exchanges. */
const PRUNE_AFTER = 7;

/**
 * The learner's curiosity pin at the first prune: the concept they said they
 * care about (see persona.interests) goes into the active set even if the
 * ranking put something else there. This is the learner's call in the story,
 * exactly the way the pin works in the app.
 */
const PIN: Partial<Record<PersonaId, RegExp>> = {
  maritime: /seaman status/i,
};

const CLOSING: Record<PersonaId, string> = {
  backend:
    "I'd say which columns the index has to cover for the actual predicate and ask for the EXPLAIN before trusting it.",
  maritime:
    "I'd name all three McCorpen elements in the prompt and ask for the causal link between the concealed condition and this injury before I let it lead the motion.",
};

type TranscriptFile = {
  personaId: PersonaId;
  exchanges: { daysAgo: number; user: string; assistant: string; longTask?: boolean }[];
};


/**
 * Every write re-stamps the seed version from its content, so a visitor's
 * stale browser state is replaced whenever the seed changes in any way.
 */
function stamp(state: LearnerState): LearnerState {
  const { seedVersion: _old, ...rest } = state;
  void _old;
  const seedVersion = createHash("sha1").update(JSON.stringify(rest)).digest("hex").slice(0, 10);
  return { ...state, seedVersion };
}

function writeSeed(pid: PersonaId, state: LearnerState) {
  const stamped = stamp(state);
  writeFileSync(`seeds/${pid}.json`, JSON.stringify(stamped, null, 2));
  return stamped;
}

function isoAt(now: Date, daysAgo: number, plusMinutes = 0): string {
  return new Date(now.getTime() - daysAgo * 86_400_000 + plusMinutes * 60_000).toISOString();
}

function nextDayOfWeek(now: Date, dow: number): Date {
  const d = new Date(now);
  const delta = (dow - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d;
}

async function generate(pid: PersonaId) {
  const { harvestCall, pruneCall, recognizeCall } = await import("@/lib/server/calls");
  const persona = PERSONAS[pid];
  const raw = readFileSync(`seeds/transcripts/${pid}.json`, "utf8");
  const transcript = JSON.parse(raw) as TranscriptFile;
  const seedVersion = createHash("sha1").update(raw + SCHEMA_VERSION).digest("hex").slice(0, 10);
  const now = new Date();

  const exchanges: Exchange[] = transcript.exchanges.map((t, i) => ({
    id: `ex_${pid}_${String(i).padStart(2, "0")}`,
    personaId: pid,
    ts: isoAt(now, t.daysAgo),
    kind: "work",
    user: t.user,
    assistant: t.assistant,
    longTask: !!t.longTask,
  }));

  const store = new MemoryStore(createInitialState(persona, seedVersion));
  console.log(`\n=== ${persona.name} (${pid}) — ${exchanges.length} exchanges, seed ${seedVersion}`);

  for (let i = 0; i < exchanges.length; i++) {
    const ex = exchanges[i];
    store.appendExchange(ex);

    // Recognize runs on the learner's words against the active set (only after prune).
    const active = activeConceptsOf(store.getState());
    if (active.length) {
      const out = await recognizeCall(ex.user, active, persona);
      let recognized: string | undefined;
      store.update((s) => {
        const r = applyRecognizeResult(s, ex.id, out, ex.ts);
        recognized = r.recognition?.id;
        return r.state;
      });
      if (recognized) {
        const recId = recognized;
        const confirmedAt = new Date(new Date(ex.ts).getTime() + 5 * 60_000).toISOString();
        store.update((s) => judgeRecognition(s, recId, "confirm", confirmedAt));
        const c = store.getState().concepts[out.proposals[0]?.conceptId ?? ""];
        console.log(`  [${i}] recognized ${c?.name ?? "?"}: "${out.proposals[0]?.quote}"`);
      }
    }

    const out = await harvestCall({ user: ex.user, assistant: ex.assistant }, store.conceptIndex(), persona);
    const result = toHarvestResult(out, ex.ts);
    store.update((s) => applyHarvest(s, ex.id, result, ex.ts));
    console.log(
      `  [${i}] ${ex.ts.slice(0, 10)} harvest: ${result.concepts.map((c) => `${c.name} (${c.learnerConfidence})`).join(", ")}` +
        `${result.learningBid ? " · bid" : ""}${result.pausePoint ? " · pause" : ""}`,
    );

    // First prune: choose the initial active set, then hold a Studio session on its first concept.
    if (i === PRUNE_AFTER - 1) {
      const at = new Date(new Date(ex.ts).getTime() + 3_600_000).toISOString();
      const pruneOut = await pruneCall(store.getState(), at);
      store.update((s) => {
        const proposal = toProposal(pruneOut, s, at);
        let ids = proposal.recommended.map((r) => r.conceptId);
        const pinRe = PIN[pid];
        const pinned = pinRe
          ? Object.values(s.concepts).find((c) => pinRe.test(c.name) && !ids.includes(c.id))
          : undefined;
        let next: LearnerState = { ...s, activeSet: { ...s.activeSet, lastProposal: proposal } };
        if (pinned) {
          next = pinConcept(next, pinned.id, true);
          ids = [...ids.slice(0, s.activeSet.size - 1), pinned.id];
          console.log(`  [${i}] learner pinned ${pinned.name}`);
        }
        return setActiveSet(next, ids);
      });
      const ids = store.getState().activeSet.conceptIds;
      console.log(`  [${i}] prune → active set: ${ids.map((id) => store.getState().concepts[id].name).join(", ")}`);

      const studioAt = new Date(new Date(ex.ts).getTime() + 26 * 3_600_000).toISOString();
      const studioEnd = new Date(new Date(studioAt).getTime() + 32 * 60_000).toISOString();
      store.update((s) => {
        const r = startStudio(
          s,
          {
            conceptId: ids[0],
            entry: "scheduled",
            materialExchangeId: pickMaterial(s, ids[0])?.id,
            workSummary: "Seeded session; work summary not retained.",
          },
          studioAt,
        );
        return endStudio(r.state, r.session.id, CLOSING[pid], studioEnd);
      });
      console.log(`  [${i}] studio session on ${store.getState().concepts[ids[0]].name}`);
    }
  }

  // Historical nudges are noise; the demo should raise its own. Then a fresh proposal at "now".
  store.update((s) => ({ ...s, nudges: [] }));
  const finalOut = await pruneCall(store.getState(), now.toISOString());
  store.update((s) => applyProposal(s, toProposal(finalOut, s, now.toISOString())));

  // A Studio block next Thursday at 2pm on the first active concept.
  const thu = nextDayOfWeek(now, 4);
  void thu;
  store.update((s) => ({
    ...s,
    calendar: [{ dayOfWeek: 4, start: "14:00", durationMin: 30, conceptId: s.activeSet.conceptIds[0] }],
    ui: { graphCollapsed: false, mode: "work" },
  }));

  const state: LearnerState = writeSeed(pid, store.getState());

  const concepts = Object.values(state.concepts);
  console.log(`  concepts: ${concepts.length}`);
  for (const c of concepts.sort((a, b) => b.signal - a.signal)) {
    const conf = c.recognitions.filter((r) => r.status === "confirmed").length;
    console.log(
      `    ${c.state.padEnd(10)} ${c.confidence.padEnd(7)} i${c.impact} s${c.signal.toFixed(2)} ×${c.timesSeen} rec${conf} ${c.pinned ? "pin " : ""}${c.name}`,
    );
  }
  console.log(`  proposal: ${state.activeSet.lastProposal?.summary}`);
  console.log(`  wrote seeds/${pid}.json`);
}

/**
 * The learner's side of the seeded Studio session, in each person's voice.
 * Claude's turns come from the real Studio prompt; the closing sentence is
 * the session's recorded closing statement.
 */
const STUDIO_LEARNER_TURNS: Record<PersonaId, string[]> = {
  backend: [
    "Equality first, because the planner can seek straight to carrier_id = 14 and the updated_at range is already sorted inside that slice. If updated_at came first it would have to walk the whole 7-day window across every carrier and filter.",
    "For the exceptions page the filter is tenant_id plus exception_status IS NOT NULL, sorted by exception_raised_at. So (tenant_id, exception_raised_at DESC) with the status in a partial WHERE, not in the key. And I'd check the plan for a Sort node before believing it.",
  ],
  maritime: [
    "Because McCorpen needs the concealed condition to be causally linked to the injury he's claiming now. If the prior injury was at L3-L4 and this one is at L5-S1, the club's IME has to bridge that gap or the third element fails, and the lie on the form doesn't save us.",
    "So the intake question has to be one a reasonable applicant would read as asking about back injuries specifically, and we need the fleet manager's declaration that they would not have hired him. Reliance is its own element; the lie alone isn't enough.",
  ],
};

/** Fill seeded Studio sessions that have no thread, using the real Studio prompt. */
async function fillStudio(pid: PersonaId) {
  const { studioCall } = await import("@/lib/server/calls");
  const persona = PERSONAS[pid];
  const state = JSON.parse(readFileSync(`seeds/${pid}.json`, "utf8")) as LearnerState;
  let sessions = state.studioSessions;
  for (const session of state.studioSessions) {
    if (session.messages.length > 0) continue;
    const concept = state.concepts[session.conceptId];
    const material = session.materialExchangeId
      ? state.exchanges.find((e) => e.id === session.materialExchangeId)
      : undefined;
    const learnerTurns = [
      ...STUDIO_LEARNER_TURNS[pid],
      `I think I've got it. ${session.closingStatement ?? CLOSING[pid]}`,
    ];
    const messages: StudioMessage[] = [];
    console.log(`=== ${pid}: filling ${session.id} on ${concept.name} (${session.rung})`);
    for (let i = 0; i <= learnerTurns.length; i++) {
      const reply = await studioCall(concept, session.rung, material, messages, persona);
      messages.push({ role: "assistant", content: reply });
      console.log(`  claude: ${reply.slice(0, 90).replace(/\s+/g, " ")}…`);
      if (i < learnerTurns.length) messages.push({ role: "user", content: learnerTurns[i] });
    }
    sessions = sessions.map((s) => (s.id === session.id ? { ...s, messages } : s));
  }
  writeSeed(pid, { ...state, studioSessions: sessions });
  console.log(`  wrote seeds/${pid}.json`);
}

/** Drop evidence quotes that aren't the learner's own words (same check as applyHarvest). */
function cleanEvidence(pid: PersonaId) {
  const state = JSON.parse(readFileSync(`seeds/${pid}.json`, "utf8")) as LearnerState;
  let dropped = 0;
  const concepts = { ...state.concepts };
  for (const c of Object.values(concepts)) {
    const kept = c.evidence.filter((e) => {
      const ex = state.exchanges.find((x) => x.id === e.exchangeId);
      const ok = !ex || quoteIsFrom(ex.user, e.quote);
      if (!ok) {
        dropped++;
        console.log(`  dropped [${c.name}] "${e.quote.slice(0, 70)}"`);
      }
      return ok;
    });
    concepts[c.id] = { ...c, evidence: kept };
  }
  writeSeed(pid, { ...state, concepts });
  console.log(`=== ${pid}: dropped ${dropped} evidence quotes that were not the learner's words`);
}

/** Redo only the final prune on an existing seed (after a prompt change). */
async function reprune(pid: PersonaId) {
  const { pruneCall } = await import("@/lib/server/calls");
  const state = JSON.parse(readFileSync(`seeds/${pid}.json`, "utf8")) as LearnerState;
  const now = new Date().toISOString();
  const cleared: LearnerState = { ...state, nudges: state.nudges.filter((n) => n.kind !== "prune-proposal") };
  const out = await pruneCall(cleared, now);
  const next = writeSeed(pid, applyProposal(cleared, toProposal(out, cleared, now)));
  console.log(`=== ${pid} repruned`);
  console.log(`  recommended: ${next.activeSet.lastProposal?.recommended.map((r) => r.conceptId).join(", ")}`);
  console.log(`  swaps: ${JSON.stringify(next.activeSet.lastProposal?.swaps)}`);
  console.log(`  summary: ${next.activeSet.lastProposal?.summary}`);
}

async function main() {
  const args = process.argv.slice(2);
  const flagReprune = args.includes("--reprune");
  const flagClean = args.includes("--clean-evidence");
  const flagStudio = args.includes("--fill-studio");
  const flagRestamp = args.includes("--restamp");
  const only = args.find((a) => !a.startsWith("--")) as PersonaId | undefined;
  for (const pid of PERSONA_IDS) {
    if (only && only !== pid) continue;
    if (flagRestamp) {
      const st = writeSeed(pid, JSON.parse(readFileSync(`seeds/${pid}.json`, "utf8")) as LearnerState);
      console.log(`=== ${pid}: seed version ${st.seedVersion}`);
    } else if (flagClean) cleanEvidence(pid);
    else if (flagStudio) await fillStudio(pid);
    else if (flagReprune) await reprune(pid);
    else await generate(pid);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
