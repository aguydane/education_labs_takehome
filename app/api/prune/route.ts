import { pruneCall } from "@/lib/server/calls";
import { errorResponse } from "@/lib/server/stream";
import type { LearnerState } from "@/lib/types";

export const maxDuration = 60;

type Body = { state: LearnerState };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;
    if (!body.state?.persona) return Response.json({ error: "state required" }, { status: 400 });
    return Response.json(await pruneCall(body.state));
  } catch (err) {
    return errorResponse(err);
  }
}
