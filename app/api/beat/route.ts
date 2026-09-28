import { client, MODELS } from "@/lib/claude";
import { PERSONAS } from "@/lib/personas";
import { buildBeatPrompt } from "@/lib/pipeline/practice";
import { errorResponse, textStreamResponse } from "@/lib/server/stream";
import type { Concept, PersonaId } from "@/lib/types";

export const maxDuration = 60;

type Body = {
  personaId: PersonaId;
  concept: Concept;
  exchange: { user: string; assistant: string };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const persona = PERSONAS[body.personaId];
    if (!persona) return Response.json({ error: "unknown persona" }, { status: 400 });
    const { system, user } = buildBeatPrompt(body.concept, body.exchange, persona);
    const stream = client.messages.stream({
      model: MODELS.learner,
      max_tokens: 600,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low" },
    });
    return textStreamResponse(stream);
  } catch (err) {
    return errorResponse(err);
  }
}
