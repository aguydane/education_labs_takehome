import type { Persona, PersonaId } from "./types";

export const PERSONAS: Record<PersonaId, Persona> = {
  backend: {
    id: "backend",
    name: "Maya Okafor",
    role: "Backend engineer at Freightline, a logistics SaaS",
    workPattern:
      "Mid-level engineer on the shipment-tracking service: Postgres, a job queue (pg-boss), " +
      "a Node/TypeScript API, and a small Kubernetes deployment. Uses Claude several times a day " +
      "for query tuning, migrations, concurrency bugs, retry logic, and infra config. Usually pastes " +
      "code or an error and asks for a fix; accepts output quickly when a deadline is close. Reviews " +
      "teammates' PRs and is increasingly asked to make architectural calls.",
    interests: [
      "Understanding Postgres well enough to reason about performance without guessing",
      "Distributed-systems fundamentals: what actually breaks under load",
    ],
    domainBrief:
      "Concept space: query planning and indexes (partial, composite, covering), transaction isolation " +
      "and lock contention, idempotency keys and exactly-once illusions, connection pooling and pool " +
      "exhaustion, back-pressure and queue depth, retries with jitter and retry storms, schema migration " +
      "safety (locks, backfills, dual writes), pagination and keyset cursors, N+1 and batching.",
    budgetPct: 20,
  },
  maritime: {
    id: "maritime",
    name: "Eli Brandt",
    role: "Second-year associate, Halvorsen & Pike, Seattle admiralty firm",
    workPattern:
      "Defends vessel owners and P&I clubs in the North Pacific fishing fleet; most files come out of " +
      "Dutch Harbor (Bering Sea crab and pollock boats, catcher-processors, tenders, and the shoreside " +
      "plants in Unalaska). Jones Act and general maritime defense. Uses Claude for exposure memos, " +
      "discovery requests, deposition summaries, and first drafts of motions. Often asks 'is this guy " +
      "covered' style questions and takes the draft to a partner for review.",
    interests: [
      "Seaman-status arguments, since they decide which body of law applies",
      "Coverage questions that decide whether the club pays",
    ],
    domainBrief:
      "Concept space: seaman status and the Chandris connection test (processor-vessel workers, " +
      "shore-side stints in Dutch Harbor), unseaworthiness vs. Jones Act negligence, maintenance and " +
      "cure and the McCorpen defense, the primary duty rule, the Limitation of Liability Act, Jones Act " +
      "vs. LHWCA classification for dockside processing, P&I coverage triggers, and Ninth Circuit / " +
      "Western District of Washington venue and choice-of-law wrinkles. Legal content is illustrative.",
    budgetPct: 20,
  },
};

export const PERSONA_IDS: PersonaId[] = ["backend", "maritime"];
