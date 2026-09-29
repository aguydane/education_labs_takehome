import { summarizeCall } from "@/lib/server/calls";
import { errorResponse } from "@/lib/server/stream";
import type { Exchange } from "@/lib/types";

export const maxDuration = 60;

type Body = { exchanges: Exchange[] };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    return Response.json({ summary: await summarizeCall(body.exchanges ?? []) });
  } catch (err) {
    return errorResponse(err);
  }
}
