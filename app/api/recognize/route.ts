import { PERSONAS } from "@/lib/personas";
import { recognizeCall } from "@/lib/server/calls";
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
    return Response.json(await recognizeCall(body.message, body.concepts ?? [], persona));
  } catch (err) {
    return errorResponse(err);
  }
}
