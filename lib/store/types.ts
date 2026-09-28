import type { ConceptIndexRow, Exchange, LearnerState } from "@/lib/types";

/**
 * The storage seam.
 *
 * The pipeline (lib/pipeline) is pure functions over LearnerState; it never
 * touches storage. Everything that persists goes through a Store.
 *
 * The prototype ships two implementations: BrowserStore (localStorage) for
 * the app and MemoryStore for the seed script. A production implementation
 * would back `getState`/`update` with one row per learner and leave the
 * pipeline untouched.
 */
export interface Store {
  getState(): LearnerState;
  /** Apply a pure transition and persist the result. */
  update(fn: (state: LearnerState) => LearnerState): LearnerState;
  /** Append to the transcript log. */
  appendExchange(exchange: Exchange): LearnerState;
  /** The projection harvest and recognize see instead of the full history. */
  conceptIndex(): ConceptIndexRow[];
}

export function conceptIndexOf(state: LearnerState): ConceptIndexRow[] {
  return Object.values(state.concepts)
    .filter((c) => c.state !== "dormant")
    .sort((a, b) => b.signal - a.signal)
    .map(({ id, name, summary, state: s, confidence }) => ({
      id,
      name,
      summary,
      state: s,
      confidence,
    }));
}
