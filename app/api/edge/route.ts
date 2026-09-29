import { client, MODELS } from "@/lib/claude";
import { PERSONAS } from "@/lib/personas";
import { buildEdgeInsightPrompt } from "@/lib/pipeline/relations";
import { errorResponse } from "@/lib/server/stream";
import type { Concept, Exchange, PersonaId, RelationKind } from "@/lib/types";

export const maxDuration = 60;

type Body = {
  personaId: PersonaId;
  a: Concept;
  b: Concept;
  kind: RelationKind;
  shared: Exchange[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const persona = PERSONAS[body.personaId];
    if (!persona || !body.a || !body.b) return Response.json({ error: "bad request" }, { status: 400 });
    const { system, user } = buildEdgeInsightPrompt(body.a, body.b, body.kind, body.shared ?? [], persona);
    const response = await client.messages.create({
      model: MODELS.background,
      max_tokens: 600,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
    });
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return Response.json({ insight: text });
  } catch (err) {
    return errorResponse(err);
  }
}
