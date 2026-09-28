import type Anthropic from "@anthropic-ai/sdk";
import { client, MODELS } from "@/lib/claude";
import { PERSONAS } from "@/lib/personas";
import { errorResponse, textStreamResponse } from "@/lib/server/stream";
import type { PersonaId } from "@/lib/types";

export const maxDuration = 60;

type Body = {
  personaId: PersonaId;
  messages: { role: "user" | "assistant"; content: string }[];
};

function chatSystem(personaId: PersonaId): string {
  const p = PERSONAS[personaId];
  return `You are Claude, working with ${p.name} (${p.role}).

About them: ${p.workPattern}

Do the work they ask for, the way a strong colleague would: direct, concrete, complete. Use code blocks for code, SQL, and config. Draft prose when prose is asked for. Keep answers focused; aim for under 350 words unless the task genuinely needs more. When you make a judgment call (an isolation level, an index, a legal theory to lead with), state it in one line so it can be questioned. Do not add tutorials or "tips" unless asked; a separate learning layer handles that.`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!PERSONAS[body.personaId]) return Response.json({ error: "unknown persona" }, { status: 400 });
    const messages: Anthropic.MessageParam[] = body.messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({ role: m.role, content: m.content }));
    if (messages.length === 0 || messages[0].role !== "user") {
      return Response.json({ error: "conversation must start with a user message" }, { status: 400 });
    }
    const stream = client.messages.stream({
      model: MODELS.learner,
      max_tokens: 3000,
      system: [{ type: "text", text: chatSystem(body.personaId), cache_control: { type: "ephemeral" } }],
      messages,
      output_config: { effort: "medium" },
    });
    return textStreamResponse(stream);
  } catch (err) {
    return errorResponse(err);
  }
}
