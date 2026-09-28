import type {
  ConceptIndexRow,
  Exchange,
  LearnerState,
  PersonaId,
} from "@/lib/types";
import { conceptIndexOf, type Store } from "./types";

const KEY = (personaId: PersonaId) => `helm:state:${personaId}`;

/**
 * Browser Store: the whole LearnerState in localStorage, one key per persona.
 * Reads are wrapped because storage can be unavailable (private mode,
 * cleared site data); the app then runs from the seed for the session.
 */
export class BrowserStore implements Store {
  private state: LearnerState;
  private listeners = new Set<(s: LearnerState) => void>();

  constructor(seed: LearnerState) {
    this.state = BrowserStore.loadOrSeed(seed);
  }

  static loadOrSeed(seed: LearnerState): LearnerState {
    try {
      const raw = localStorage.getItem(KEY(seed.persona.id));
      if (raw) {
        const parsed = JSON.parse(raw) as LearnerState;
        if (parsed.version === seed.version && parsed.seedVersion === seed.seedVersion) {
          return parsed;
        }
      }
    } catch {
      // fall through to seed
    }
    return seed;
  }

  static clear(personaId: PersonaId) {
    try {
      localStorage.removeItem(KEY(personaId));
    } catch {
      // ignore
    }
  }

  subscribe(fn: (s: LearnerState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  getState(): LearnerState {
    return this.state;
  }

  update(fn: (state: LearnerState) => LearnerState): LearnerState {
    this.state = fn(this.state);
    try {
      localStorage.setItem(KEY(this.state.persona.id), JSON.stringify(this.state));
    } catch {
      // storage unavailable; keep going in memory
    }
    for (const l of this.listeners) l(this.state);
    return this.state;
  }

  appendExchange(exchange: Exchange): LearnerState {
    return this.update((s) => ({ ...s, exchanges: [...s.exchanges, exchange] }));
  }

  conceptIndex(): ConceptIndexRow[] {
    return conceptIndexOf(this.state);
  }
}
