import backend from "@/seeds/backend.json";
import maritime from "@/seeds/maritime.json";
import { PERSONAS } from "./personas";
import { createInitialState } from "./state";
import type { LearnerState, PersonaId } from "./types";

const SEEDS: Record<PersonaId, LearnerState> = {
  backend: backend as unknown as LearnerState,
  maritime: maritime as unknown as LearnerState,
};

/** A fresh copy of the persona's seed (never the shared object). */
export function loadSeed(personaId: PersonaId): LearnerState {
  const seed = SEEDS[personaId];
  if (!seed || !seed.persona) return createInitialState(PERSONAS[personaId]);
  return JSON.parse(JSON.stringify(seed)) as LearnerState;
}
