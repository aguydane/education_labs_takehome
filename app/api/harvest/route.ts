import { PERSONAS } from "@/lib/personas";
import { harvestCall } from "@/lib/server/calls";
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
    return Response.json(await harvestCall(body.exchange, body.index ?? [], persona));
  } catch (err) {
    return errorResponse(err);
  }
}
