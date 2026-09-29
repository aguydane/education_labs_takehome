import type Anthropic from "@anthropic-ai/sdk";
import { client, MODELS } from "@/lib/claude";
import { PERSONAS } from "@/lib/personas";
import { buildStudioSystem, STUDIO_OPENING_USER } from "@/lib/pipeline/practice";
import { errorResponse, textStreamResponse } from "@/lib/server/stream";
import type { Concept, PersonaId, Rung, StudioMessage } from "@/lib/types";

export const maxDuration = 60;

type Body = {
  personaId: PersonaId;
  concept: Concept;
  rung: Rung;
  material?: { user: string; assistant: string; ts: string };
  messages: StudioMessage[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const persona = PERSONAS[body.personaId];
    if (!persona) return Response.json({ error: "unknown persona" }, { status: 400 });

    const system = buildStudioSystem(body.concept, body.rung, body.material, persona);
    const history: Anthropic.MessageParam[] = (body.messages ?? [])
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
    const messages: Anthropic.MessageParam[] =
      history.length === 0 || history[0].role !== "user"
        ? [{ role: "user", content: STUDIO_OPENING_USER }, ...history]
        : history;

    const stream = client.messages.stream({
      model: MODELS.learner,
      // Opus 5.5 thinks before it writes and the thinking counts against
      // max_tokens, so the cap has to leave room for both.
      max_tokens: 8000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages,
      output_config: { effort: "high" },
    });
    return textStreamResponse(stream);
  } catch (err) {
    return errorResponse(err);
  }
}
