import { DEFAULT_ACTIVE_SET_SIZE, type LearnerState, type Persona } from "./types";

export function createInitialState(persona: Persona, seedVersion = "dev"): LearnerState {
  return {
    version: 1,
    seedVersion,
    persona,
    exchanges: [],
    concepts: {},
    activeSet: { conceptIds: [], size: DEFAULT_ACTIVE_SET_SIZE },
    calendar: [],
    nudges: [],
    beats: [],
    studioSessions: [],
    ui: { graphCollapsed: false, mode: "work" },
  };
}
