import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, MODELS } from "@/lib/claude";
import { PERSONAS } from "@/lib/personas";
import { buildRecognizePrompt, RecognizeSchema } from "@/lib/pipeline/recognize";
import { errorResponse } from "@/lib/server/stream";
import type { Concept, PersonaId } from "@/lib/types";

export const maxDuration = 60;

type Body = {
  personaId: PersonaId;
  message: string;
  concepts: Concept[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const persona = PERSONAS[body.personaId];
    if (!persona) return Response.json({ error: "unknown persona" }, { status: 400 });
    if (!body.concepts?.length) return Response.json({ proposals: [] });
    const { system, user } = buildRecognizePrompt(body.message, body.concepts, persona);
    const response = await client.messages.parse({
      model: MODELS.background,
      max_tokens: 800,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: zodOutputFormat(RecognizeSchema) },
    });
    return Response.json(response.parsed_output ?? { proposals: [] });
  } catch (err) {
    return errorResponse(err);
  }
}
