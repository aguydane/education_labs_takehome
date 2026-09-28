import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { client, MODELS } from "@/lib/claude";
import { buildPrunePrompt, PruneSchema } from "@/lib/pipeline/prune";
import { errorResponse } from "@/lib/server/stream";
import type { LearnerState } from "@/lib/types";

export const maxDuration = 60;

type Body = { state: LearnerState };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body.state?.persona) return Response.json({ error: "state required" }, { status: 400 });
    const { system, user } = buildPrunePrompt(body.state);
    const response = await client.messages.parse({
      model: MODELS.learner,
      max_tokens: 3000,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
      output_config: { effort: "high", format: zodOutputFormat(PruneSchema) },
    });
    if (!response.parsed_output) {
      return Response.json({ error: "prune returned no parseable output" }, { status: 502 });
    }
    return Response.json(response.parsed_output);
  } catch (err) {
    return errorResponse(err);
  }
}
