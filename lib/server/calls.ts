/**
 * The Claude calls behind the pipeline, shared by the API routes and the
 * seed generator so both run exactly the same code.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, MODELS } from "@/lib/claude";
import { buildHarvestPrompt, HarvestSchema, type HarvestOutput } from "@/lib/pipeline/harvest";
import { buildStudioSystem, STUDIO_OPENING_USER } from "@/lib/pipeline/practice";
import { buildPrunePrompt, PruneSchema, type PruneOutput } from "@/lib/pipeline/prune";
import { buildRecognizePrompt, RecognizeSchema, type RecognizeOutput } from "@/lib/pipeline/recognize";
import type {
  Concept,
  ConceptIndexRow,
  Exchange,
  LearnerState,
  Persona,
  Rung,
  StudioMessage,
} from "@/lib/types";

export async function harvestCall(
  exchange: { user: string; assistant: string },
  index: ConceptIndexRow[],
  persona: Persona,
): Promise<HarvestOutput> {
  const { system, user } = buildHarvestPrompt(exchange, index, persona);
  const response = await client.messages.parse({
    model: MODELS.background,
    max_tokens: 2000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: zodOutputFormat(HarvestSchema) },
  });
  if (!response.parsed_output) throw new Error("harvest returned no parseable output");
  return response.parsed_output;
}

export async function recognizeCall(
  message: string,
  concepts: Concept[],
  persona: Persona,
): Promise<RecognizeOutput> {
  if (concepts.length === 0) return { proposals: [] };
  const { system, user } = buildRecognizePrompt(message, concepts, persona);
  const response = await client.messages.parse({
    model: MODELS.background,
    max_tokens: 800,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    thinking: { type: "disabled" },
    output_config: { effort: "low", format: zodOutputFormat(RecognizeSchema) },
  });
  return response.parsed_output ?? { proposals: [] };
}

/** One Studio turn, non-streaming (the route streams; the seed generator doesn't need to). */
export async function studioCall(
  concept: Concept,
  rung: Rung,
  material: Pick<Exchange, "user" | "assistant" | "ts"> | undefined,
  messages: StudioMessage[],
  persona: Persona,
  resumed = false,
): Promise<string> {
  const system = buildStudioSystem(concept, rung, material, persona, resumed);
  const history: Anthropic.MessageParam[] = messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
  const turns: Anthropic.MessageParam[] =
    history.length === 0 || history[0].role !== "user"
      ? [{ role: "user", content: STUDIO_OPENING_USER }, ...history]
      : history;
  const stream = client.messages.stream({
    model: MODELS.learner,
    max_tokens: 8000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: turns,
    output_config: { effort: "high" },
  });
  const final = await stream.finalMessage();
  return final.content
    .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export async function pruneCall(state: LearnerState, now?: string): Promise<PruneOutput> {
  const { system, user } = buildPrunePrompt(state, now);
  const response = await client.messages.parse({
    model: MODELS.learner,
    // Thinking counts against the cap; a truncated JSON body is unparseable.
    max_tokens: 8000,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
    output_config: { effort: "high", format: zodOutputFormat(PruneSchema) },
  });
  if (!response.parsed_output) throw new Error("prune returned no parseable output");
  return response.parsed_output;
}
