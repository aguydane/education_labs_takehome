/**
 * Seed generator.
 *
 * Reads the synthetic work transcripts in seeds/transcripts/<persona>.json,
 * replays them through the REAL pipeline (harvest → prune → recognize) in
 * chronological order, adds one past Studio session, and writes
 * seeds/<persona>.json. The seed is what the system produces, not
 * hand-written output.
 *
 *   npx tsx scripts/generate-seeds.ts            # both personas
 *   npx tsx scripts/generate-seeds.ts maritime   # one persona
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config();

import { createHash } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { PERSONAS, PERSONA_IDS } from "@/lib/personas";
import { applyHarvest, toHarvestResult } from "@/lib/pipeline/harvest";
import { endStudio, pickMaterial, startStudio } from "@/lib/pipeline/practice";
import { applyProposal, setActiveSet, toProposal } from "@/lib/pipeline/prune";
import { activeConceptsOf, applyRecognizeResult, judgeRecognition } from "@/lib/pipeline/recognize";
import { createInitialState } from "@/lib/state";
import { MemoryStore } from "@/lib/store/memory";
import type { Exchange, LearnerState, PersonaId } from "@/lib/types";

const SCHEMA_VERSION = "seed-schema-1";
/** Prune (and choose the first active set) after this many exchanges. */
const PRUNE_AFTER = 7;

const CLOSING: Record<PersonaId, string> = {
  backend:
    "I'd say which columns the index has to cover for the actual predicate and ask for the EXPLAIN before trusting it.",
  maritime:
    "I'd say which months count toward the 30% and ask what facts would break the vessel connection before I lead with it.",
};

type TranscriptFile = {
  personaId: PersonaId;
  exchanges: { daysAgo: number; user: string; assistant: string; longTask?: boolean }[];
};

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
        const ids = proposal.recommended.map((r) => r.conceptId);
        return setActiveSet({ ...s, activeSet: { ...s.activeSet, lastProposal: proposal } }, ids);
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

  const state: LearnerState = store.getState();
  writeFileSync(`seeds/${pid}.json`, JSON.stringify(state, null, 2));

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

async function main() {
  const only = process.argv[2] as PersonaId | undefined;
  for (const pid of PERSONA_IDS) {
    if (only && only !== pid) continue;
    await generate(pid);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
