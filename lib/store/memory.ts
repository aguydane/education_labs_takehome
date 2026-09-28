import type { ConceptIndexRow, Exchange, LearnerState } from "@/lib/types";
import { conceptIndexOf, type Store } from "./types";

/** In-memory Store. Used by the seed script and tests. */
export class MemoryStore implements Store {
  private state: LearnerState;

  constructor(initial: LearnerState) {
    this.state = initial;
  }

  getState(): LearnerState {
    return this.state;
  }

  update(fn: (state: LearnerState) => LearnerState): LearnerState {
    this.state = fn(this.state);
    return this.state;
  }

  appendExchange(exchange: Exchange): LearnerState {
    return this.update((s) => ({ ...s, exchanges: [...s.exchanges, exchange] }));
  }

  conceptIndex(): ConceptIndexRow[] {
    return conceptIndexOf(this.state);
  }
}
