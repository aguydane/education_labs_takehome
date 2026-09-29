"use client";

import { useState, type ReactNode } from "react";
import type { LearnerActions } from "@/lib/learner-context";
import type { Concept, Exchange, Nudge, Recognition } from "@/lib/types";
import ConceptChips, { ChipSkeleton } from "./ConceptChips";
import { FLASH_MS, findQuote } from "./helpers";
import Markdown from "./Markdown";
import { BeatOffer, StudioOffer } from "./Offers";
import RecognitionCard from "./RecognitionCard";
import styles from "./work.module.css";

export type RecognitionEntry = { recognition: Recognition; concept: Concept };

export default function ExchangeItem({
  exchange,
  concepts,
  recognitions,
  offers,
  streaming,
  harvesting,
  flashKey,
  actions,
}: {
  exchange: Exchange;
  concepts: Record<string, Concept>;
  recognitions: RecognitionEntry[];
  offers: Nudge[];
  streaming: boolean;
  harvesting: boolean;
  /** Non-null while this exchange is being revealed; changes on every reveal. */
  flashKey: number | null;
  actions: LearnerActions;
}) {
  // The quote a chip's "Show in chat" pointed at, underlined while the reveal lands.
  const [shownQuote, setShownQuote] = useState<string | null>(null);
  const showInChat = (quote: string) => {
    setShownQuote(quote || null);
    window.setTimeout(() => setShownQuote(null), FLASH_MS + 1000);
    actions.revealExchange(exchange.id);
  };

  const proposed = recognitions.find((r) => r.recognition.status === "proposed");
  const recognitionRange = proposed ? findQuote(exchange.user, proposed.recognition.quote) : null;
  const shownRange = shownQuote ? findQuote(exchange.user, shownQuote) : null;
  const flashing = flashKey !== null;

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
          key={flashing ? `flash-${flashKey}` : "rest"}
          className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-panel-2 px-3.5 py-2 text-sm leading-relaxed text-ink ${
            flashing ? styles.flash : ""
          }`}
          title={new Date(exchange.ts).toLocaleString()}
          data-testid={flashing ? "exchange-flash" : undefined}
        >
          {shownRange
            ? withMark(exchange.user, shownRange, "decoration-accent")
            : recognitionRange
              ? withMark(exchange.user, recognitionRange, "decoration-st-practicing")
              : exchange.user}
        </div>
        {exchange.longTask ? <p className="text-xs text-ink-2">Started long-running work</p> : null}
        {recognitions.map(({ recognition, concept }) =>
          recognition.status === "proposed" ? (
            <RecognitionCard
              key={recognition.id}
              recognition={recognition}
              concept={concept}
              underlined={recognition === proposed?.recognition && recognitionRange !== null}
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
            onShowInChat={showInChat}
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

/** The learner's text with one span underlined (a quote someone is pointing at). */
function withMark(text: string, [start, end]: [number, number], decoration: string): ReactNode {
  return (
    <>
      {text.slice(0, start)}
      <mark className={`bg-transparent text-ink underline decoration-2 underline-offset-4 ${decoration}`}>
        {text.slice(start, end)}
      </mark>
      {text.slice(end)}
    </>
  );
}
