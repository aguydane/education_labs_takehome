/**
 * Browser-side helpers for the Helm API routes. Client components import
 * from here; they never import the Anthropic SDK.
 */

import type { HarvestOutput } from "./pipeline/harvest";
import type { PruneOutput } from "./pipeline/prune";
import type { RecognizeOutput } from "./pipeline/recognize";
import type {
  Concept,
  ConceptIndexRow,
  Exchange,
  LearnerState,
  PersonaId,
  RelationKind,
  Rung,
  StudioMessage,
} from "./types";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      // keep status text
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/** POST and stream plain-text deltas to `onDelta`. Resolves with the full text. */
export async function streamText(
  url: string,
  body: unknown,
  onDelta: (delta: string, full: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) message = j.error;
    } catch {
      // keep status text
    }
    throw new Error(message);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const delta = decoder.decode(value, { stream: true });
    full += delta;
    onDelta(delta, full);
  }
  return full;
}

export const api = {
  chat: (
    personaId: PersonaId,
    messages: { role: "user" | "assistant"; content: string }[],
    onDelta: (delta: string, full: string) => void,
    signal?: AbortSignal,
  ) => streamText("/api/chat", { personaId, messages }, onDelta, signal),

  harvest: (personaId: PersonaId, exchange: { user: string; assistant: string }, index: ConceptIndexRow[]) =>
    postJson<HarvestOutput>("/api/harvest", { personaId, exchange, index }),

  recognize: (personaId: PersonaId, message: string, concepts: Concept[]) =>
    postJson<RecognizeOutput>("/api/recognize", { personaId, message, concepts }),

  prune: (state: LearnerState) => postJson<PruneOutput>("/api/prune", { state }),

  beat: (
    personaId: PersonaId,
    concept: Concept,
    exchange: { user: string; assistant: string },
    onDelta: (delta: string, full: string) => void,
  ) => streamText("/api/beat", { personaId, concept, exchange }, onDelta),

  studio: (
    personaId: PersonaId,
    concept: Concept,
    rung: Rung,
    material: { user: string; assistant: string; ts: string } | undefined,
    messages: StudioMessage[],
    onDelta: (delta: string, full: string) => void,
    resumed = false,
  ) => streamText("/api/studio", { personaId, concept, rung, material, messages, resumed }, onDelta),

  summarize: (exchanges: Exchange[]) => postJson<{ summary: string }>("/api/summarize", { exchanges }),

  edge: (personaId: PersonaId, a: Concept, b: Concept, kind: RelationKind, shared: Exchange[]) =>
    postJson<{ insight: string }>("/api/edge", { personaId, a, b, kind, shared }),
};
