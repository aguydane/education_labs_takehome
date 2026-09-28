import type { Page, Route } from "@playwright/test";

/**
 * Deterministic stand-ins for the Claude routes. Each mock reads the
 * request body so responses stay consistent with whatever seed the app
 * loaded (ids come from the request, never from fixtures).
 */

type HarvestBody = {
  exchange: { user: string; assistant: string };
  index: { id: string; name: string }[];
};

type RecognizeBody = {
  message: string;
  concepts: { id: string; name: string; recognitions: { ts: string; status: string }[] }[];
};

type PruneBody = {
  state: {
    activeSet: { conceptIds: string[]; size: number };
    concepts: Record<string, { id: string; name: string; state: string; signal: number }>;
  };
};

export const MOCK = {
  chatReply: "Here is the change. I used a composite index on (carrier_id, status, created_at DESC) so the LIMIT can stop early.",
  beatText:
    "The index column order matters because equality predicates go first and the sort column last, which lets the planner read rows already in ORDER BY order.\n\nIf the query filtered on a range instead of an equality, which column would you move?",
  studioOpening: "Let's start with your own query from last week. Before anything else: what does the WHERE clause actually need the index to cover?",
  studioReply: "Good. Now say which column should come last, and why.",
  summary: "You were tuning the shipment_events query.\nThe composite index is written but not yet verified with EXPLAIN.\nNext: run EXPLAIN (ANALYZE, BUFFERS) and compare plans.",
  newConceptName: "Mocked new concept",
  recognizePhrase: "partial index",
};

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

function text(route: Route, body: string) {
  return route.fulfill({ status: 200, contentType: "text/plain; charset=utf-8", body });
}

export async function mockClaudeRoutes(page: Page) {
  await page.route("**/api/chat", (route) => text(route, MOCK.chatReply));
  await page.route("**/api/beat", (route) => text(route, MOCK.beatText));
  await page.route("**/api/summarize", (route) => json(route, { summary: MOCK.summary }));

  await page.route("**/api/studio", (route) => {
    // The route adds the session-start user turn itself, so any user message
    // in the body means the learner has spoken.
    const body = route.request().postDataJSON() as { messages: { role: string }[] };
    const learnerSpoke = (body.messages ?? []).some((m) => m.role === "user");
    return text(route, learnerSpoke ? MOCK.studioReply : MOCK.studioOpening);
  });

  await page.route("**/api/harvest", (route) => {
    const body = route.request().postDataJSON() as HarvestBody;
    const user = body.exchange.user.toLowerCase();
    const existing = body.index[0];
    return json(route, {
      concepts: [
        ...(existing
          ? [
              {
                name: existing.name,
                matchesExistingId: existing.id,
                summary: "Existing concept, seen again.",
                whyItMattersHere: "Lets you judge whether the choice made here was the right one.",
                impact: 4,
                learnerConfidence: "low",
                evidenceFromUser: body.exchange.user.slice(0, 60),
                rubricHints: ["Specifies the constraint precisely"],
              },
            ]
          : []),
        {
          name: MOCK.newConceptName,
          matchesExistingId: null,
          summary: "A concept the mock harvest always returns.",
          whyItMattersHere: "Lets you tell whether the assistant's default was appropriate.",
          impact: 3,
          learnerConfidence: "unknown",
          evidenceFromUser: "",
          rubricHints: ["Asks about the default before accepting it"],
        },
      ],
      learningBid: user.includes("why"),
      bidConceptName: user.includes("why") ? (existing?.name ?? MOCK.newConceptName) : null,
      pausePoint: user.includes("thanks") || user.includes("ship it"),
    });
  });

  await page.route("**/api/recognize", (route) => {
    const body = route.request().postDataJSON() as RecognizeBody;
    // The pipeline spaces recognitions 24h apart per concept, so pick an
    // active concept the seed hasn't recognized recently.
    const dayAgo = Date.now() - 24 * 3_600_000;
    const first =
      body.concepts.find(
        (c) => !c.recognitions.some((r) => r.status !== "rejected" && Date.parse(r.ts) > dayAgo),
      ) ?? body.concepts[0];
    if (!first || !body.message.toLowerCase().includes(MOCK.recognizePhrase)) {
      return json(route, { proposals: [] });
    }
    return json(route, {
      proposals: [
        {
          conceptId: first.id,
          quote: body.message.slice(0, 80),
          explanation: `This is evidence you understand ${first.name}: the constraint is specified rather than requested.`,
          confidence: "high",
        },
      ],
    });
  });

  await page.route("**/api/prune", (route) => {
    const body = route.request().postDataJSON() as PruneBody;
    const { activeSet, concepts } = body.state;
    const rankable = Object.values(concepts)
      .filter((c) => ["noticed", "chosen", "practicing"].includes(c.state))
      .sort((a, b) => b.signal - a.signal);
    const current = activeSet.conceptIds.filter((id) => concepts[id]);
    const challenger = rankable.find((c) => !current.includes(c.id));
    const recommended = [...current];
    if (recommended.length < activeSet.size && challenger) recommended.push(challenger.id);
    const swaps =
      recommended.length >= activeSet.size && challenger && !recommended.includes(challenger.id)
        ? [{ out: current[current.length - 1], in: challenger.id, reasoning: "The challenger has come up more often lately." }]
        : [];
    if (swaps.length) {
      recommended[recommended.length - 1] = challenger!.id;
    }
    return json(route, {
      recommended: recommended.slice(0, activeSet.size).map((id) => ({
        conceptId: id,
        reasoning: `${concepts[id].name} keeps deciding whether an output is right.`,
      })),
      swaps,
      summary: "Mostly continuity, with one concept worth weighing.",
    });
  });
}
