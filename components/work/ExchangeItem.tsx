"use client";

import type { LearnerActions } from "@/lib/learner-context";
import type { Concept, Exchange, Nudge, Recognition } from "@/lib/types";
import ConceptChips, { ChipSkeleton } from "./ConceptChips";
import Markdown from "./Markdown";
import { BeatOffer, StudioOffer } from "./Offers";
import RecognitionCard from "./RecognitionCard";

export type RecognitionEntry = { recognition: Recognition; concept: Concept };

export default function ExchangeItem({
  exchange,
  concepts,
  recognitions,
  offers,
  streaming,
  harvesting,
  actions,
}: {
  exchange: Exchange;
  concepts: Record<string, Concept>;
  recognitions: RecognitionEntry[];
  offers: Nudge[];
  streaming: boolean;
  harvesting: boolean;
  actions: LearnerActions;
}) {
  const text = exchange.assistant;
  const isError = text.startsWith("[error");
  const showSkeleton = !exchange.harvest && harvesting && !streaming && !!text && !isError;
  const beatOffers = offers.filter((n) => n.kind === "beat-offer");
  const studioOffers = offers.filter((n) => n.kind === "studio-offer");

  return (
    <article className="flex flex-col gap-3" data-testid={`exchange-${exchange.id}`}>
      {/* Learner */}
      <div className="flex flex-col items-end gap-2 pl-10">
        <div
          className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-panel-2 px-3.5 py-2 text-sm leading-relaxed text-ink"
          title={new Date(exchange.ts).toLocaleString()}
        >
          {exchange.user}
        </div>
        {exchange.longTask ? <p className="text-xs text-ink-2">Started long-running work</p> : null}
        {recognitions.map(({ recognition, concept }) =>
          recognition.status === "proposed" ? (
            <RecognitionCard
              key={recognition.id}
              recognition={recognition}
              concept={concept}
              onJudge={actions.judgeRecognition}
            />
          ) : recognition.status === "confirmed" ? (
            <p
              key={recognition.id}
              className="flex items-center gap-1.5 text-xs text-ink-2"
              data-testid={`recognition-note-${recognition.id}`}
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-st-durable" />
              Recognized: {concept.name}
            </p>
          ) : null,
        )}
      </div>

      {/* Assistant */}
      <div className="flex flex-col gap-2.5 pr-6">
        {streaming && !text ? (
          <p className="flex items-center gap-2 text-sm text-ink-2" data-testid="work-thinking">
            <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Thinking
          </p>
        ) : isError ? (
          <p className="text-sm text-warn">{text.replace(/^\[error:?\s*/, "The reply failed: ").replace(/\]$/, "")}</p>
        ) : text ? (
          <Markdown text={text} streaming={streaming} />
        ) : (
          <p className="text-sm text-ink-2">No reply.</p>
        )}

        {exchange.harvest ? (
          <ConceptChips
            exchangeId={exchange.id}
            harvested={exchange.harvest.concepts}
            concepts={concepts}
            actions={actions}
          />
        ) : showSkeleton ? (
          <ChipSkeleton />
        ) : null}

        {beatOffers.map((n) => (
          <BeatOffer key={n.id} nudge={n} concept={n.conceptId ? concepts[n.conceptId] : undefined} actions={actions} />
        ))}
        {studioOffers.map((n) => (
          <StudioOffer
            key={n.id}
            nudge={n}
            concept={n.conceptId ? concepts[n.conceptId] : undefined}
            actions={actions}
          />
        ))}
      </div>
    </article>
  );
}
