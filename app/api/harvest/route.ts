import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, MODELS } from "@/lib/claude";
import { PERSONAS } from "@/lib/personas";
import { buildHarvestPrompt, HarvestSchema } from "@/lib/pipeline/harvest";
import { errorResponse } from "@/lib/server/stream";
import type { ConceptIndexRow, PersonaId } from "@/lib/types";

export const maxDuration = 60;

type Body = {
  personaId: PersonaId;
  exchange: { user: string; assistant: string };
  index: ConceptIndexRow[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const persona = PERSONAS[body.personaId];
    if (!persona) return Response.json({ error: "unknown persona" }, { status: 400 });
    const { system, user } = buildHarvestPrompt(body.exchange, body.index ?? [], persona);
    const response = await client.messages.parse({
      model: MODELS.background,
      max_tokens: 2000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      thinking: { type: "disabled" },
      output_config: { effort: "low", format: zodOutputFormat(HarvestSchema) },
    });
    if (!response.parsed_output) {
      return Response.json({ error: "harvest returned no parseable output" }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (err) {
    return errorResponse(err);
  }
}
