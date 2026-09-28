import { client, MODELS } from "@/lib/claude";
import { buildSummarizePrompt } from "@/lib/pipeline/practice";
import { errorResponse } from "@/lib/server/stream";
import type { Exchange } from "@/lib/types";

export const maxDuration = 60;

type Body = { exchanges: Exchange[] };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    const recent = (body.exchanges ?? []).filter((e) => e.kind === "work").slice(-6);
    const { system, user } = buildSummarizePrompt(recent);
    const response = await client.messages.create({
      model: MODELS.background,
      max_tokens: 400,
      system,
      messages: [{ role: "user", content: user }],
      thinking: { type: "disabled" },
      output_config: { effort: "low" },
    });
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return Response.json({ summary: text });
  } catch (err) {
    return errorResponse(err);
  }
}
