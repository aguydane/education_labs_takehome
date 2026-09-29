"use client";

import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import type { LearnerActions } from "@/lib/learner-context";
import Hint from "@/components/ui/Hint";
import type { Concept, HarvestedConcept } from "@/lib/types";
import {
  BTN_QUIET,
  BTN_QUIET_ACCENT,
  CONFIDENCE_DOT,
  FOCUS,
  HINTS,
  HINT_IN_ROW,
  STATE_DOT,
  STATE_LABEL,
  resolveConcept,
} from "./helpers";

type Item = { key: string; hc: HarvestedConcept; concept?: Concept };

const POPOVER_W = 320;
const POPOVER_H = 440;

export default function ConceptChips({
  exchangeId,
  harvested,
  concepts,
  actions,
  onShowInChat,
}: {
  exchangeId: string;
  harvested: HarvestedConcept[];
  concepts: Record<string, Concept>;
  actions: LearnerActions;
  /** Reveal this exchange in the chat, underlining `quote` in the learner's message. */
  onShowInChat: (quote: string) => void;
}) {
  const seen = new Set<string>();
  const items: Item[] = [];
  for (const hc of harvested) {
    const concept = resolveConcept(hc, concepts);
    const key = concept ? concept.id : `unresolved:${hc.name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ key, hc, concept });
  }
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Ideas in this reply">
      <span className="mr-0.5 inline-flex items-center gap-1 text-[11px] text-ink-2">
        Ideas in this reply
        <Hint text={HINTS.ideas} label="What are these?" />
      </span>
      {items.map((it) =>
        it.concept ? (
          <Chip
            key={it.key}
            exchangeId={exchangeId}
            hc={it.hc}
            concept={it.concept}
            actions={actions}
            onShowInChat={onShowInChat}
          />
        ) : (
          <span
            key={it.key}
            className="inline-flex cursor-default items-center gap-1.5 rounded-full border border-rule px-2.5 py-0.5 text-xs text-ink-2"
            title={it.hc.whyItMattersHere}
            data-testid="concept-chip-unresolved"
          >
            <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT[it.hc.learnerConfidence]}`} />
            {it.hc.name}
          </span>
        ),
      )}
    </div>
  );
}

/** Skeleton shown where chips will go while harvest reads the exchange. */
export function ChipSkeleton() {
  return (
    <div className="flex items-center gap-1.5" aria-live="polite" data-testid="chips-reading">
      <span className="h-5 w-24 animate-pulse rounded-full bg-panel-2" />
      <span className="h-5 w-16 animate-pulse rounded-full bg-panel-2" />
      <span className="ml-1 text-xs text-ink-2">reading…</span>
    </div>
  );
}

type Placement = { up: boolean; right: boolean };

function Chip({
  exchangeId,
  hc,
  concept,
  actions,
  onShowInChat,
}: {
  exchangeId: string;
  hc: HarvestedConcept;
  concept: Concept;
  actions: LearnerActions;
  onShowInChat: (quote: string) => void;
}) {
  const [open, setOpen] = useState<Placement | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const chipRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const popId = useId();

  useEffect(() => {
    if (!open) return;
    popRef.current?.focus({ preventScroll: true });
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && e.target instanceof Node && !wrapRef.current.contains(e.target)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(null);
      chipRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (e: MouseEvent<HTMLButtonElement>) => {
    if (open) {
      setOpen(null);
      return;
    }
    // Place the popover where it fits inside the scrolling message list.
    const chip = e.currentTarget.getBoundingClientRect();
    const box = e.currentTarget.closest("[data-testid='work-messages']")?.getBoundingClientRect();
    if (!box) {
      setOpen({ up: false, right: false });
      return;
    }
    const below = box.bottom - chip.bottom;
    const above = chip.top - box.top;
    setOpen({
      up: below < POPOVER_H && above > below,
      right: chip.left + POPOVER_W > box.right - 8,
    });
  };

  const delegated = concept.state === "delegated";
  const confidence = concept.confidence;
  const learnerSaid = concept.confidenceSource === "learner";
  const quote =
    hc.evidenceFromUser?.trim() || concept.evidence.find((ev) => ev.exchangeId === exchangeId)?.quote || "";
  const why = hc.whyItMattersHere?.trim() || concept.whyItMatters;

  const chipTone = open
    ? "border-accent text-ink"
    : delegated
      ? "border-dashed border-rule text-ink-2 opacity-55 hover:opacity-80"
      : "border-rule text-ink-2 hover:border-ink-2 hover:text-ink";

  return (
    <span ref={wrapRef} className="relative inline-flex">
      <button
        ref={chipRef}
        type="button"
        onClick={toggle}
        aria-expanded={open !== null}
        aria-haspopup="dialog"
        aria-controls={open ? popId : undefined}
        title={delegated ? `${concept.name} (delegated)` : concept.name}
        className={`inline-flex items-center gap-1.5 rounded-full border bg-panel px-2.5 py-0.5 text-xs transition-colors ${chipTone} ${FOCUS}`}
        data-testid={`concept-chip-${concept.id}`}
      >
        <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${CONFIDENCE_DOT[confidence]}`} />
        {concept.name}
        <span className="sr-only">
          , confidence {confidence}
          {delegated ? ", delegated" : ""}
        </span>
      </button>

      {open ? (
        <div
          ref={popRef}
          id={popId}
          role="dialog"
          aria-label={concept.name}
          tabIndex={-1}
          className={`absolute z-20 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-rule bg-panel p-3.5 text-left shadow-md outline-none ${
            open.up ? "bottom-full mb-1.5" : "top-full mt-1.5"
          } ${open.right ? "right-0" : "left-0"}`}
          data-testid="chip-popover"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm font-medium text-ink">{concept.name}</p>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-ink-2">
              <span aria-hidden className={`h-2 w-2 rounded-full ${STATE_DOT[concept.state]}`} />
              {STATE_LABEL[concept.state]}
            </span>
          </div>
          <p className="relative mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
            An idea Claude leaned on in this reply.
            <Hint text={HINTS.ideas} label="What is this?" className={HINT_IN_ROW} />
          </p>

          {why ? (
            <div className="relative mt-3">
              <p className="flex items-center gap-1.5 text-xs text-ink-2">
                Why it matters here
                <Hint text={HINTS.whyHere} label="What does this mean?" className={HINT_IN_ROW} />
              </p>
              <p className="mt-0.5 text-sm leading-snug text-ink">{why}</p>
            </div>
          ) : null}

          <div className="relative mt-3">
            <div className="flex items-center gap-1.5 text-xs text-ink-2">
              From what you wrote
              <Hint text={HINTS.fromYou} label="Where does this come from?" className={HINT_IN_ROW} />
              <button
                type="button"
                className={`ml-auto rounded text-xs text-accent-ink underline-offset-2 hover:underline ${FOCUS}`}
                onClick={() => {
                  setOpen(null);
                  onShowInChat(quote);
                }}
                data-testid="chip-show-in-chat"
              >
                Show in chat
              </button>
            </div>
            {quote ? (
              <blockquote className="mt-1 border-l-2 border-rule pl-2.5 text-sm leading-snug text-ink-2">
                &ldquo;{quote}&rdquo;
              </blockquote>
            ) : (
              <p className="mt-1 text-sm leading-snug text-ink-2">Nothing you wrote here spoke to it either way.</p>
            )}
          </div>

          <p className="mt-3 flex items-center gap-1.5 text-xs text-ink-2">
            <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${CONFIDENCE_DOT[confidence]}`} />
            <span>
              Confidence: {confidence} ·{" "}
              {learnerSaid ? "you said so" : confidence === "unknown" ? "no signal yet" : "from your wording in this exchange"}
            </span>
          </p>

          <div className="mt-3 border-t border-rule pt-3">
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className={BTN_QUIET}
                aria-pressed={learnerSaid && confidence === "high"}
                onClick={() => actions.judgeConcept(concept.id, "know")}
                data-testid="chip-know"
              >
                I know this
              </button>
              <button
                type="button"
                className={BTN_QUIET}
                aria-pressed={learnerSaid && confidence === "low"}
                onClick={() => actions.judgeConcept(concept.id, "dont")}
                data-testid="chip-dont"
              >
                I don&apos;t
              </button>
              <button
                type="button"
                className={BTN_QUIET}
                onClick={() => actions.judgeConcept(concept.id, delegated ? "undelegate" : "delegate")}
                data-testid="chip-delegate"
              >
                {delegated ? "Bring back" : "Keep delegating"}
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-snug text-ink-2">
              I know this / I don&apos;t correct Helm&apos;s read. Keep delegating means never suggesting practice; it
              stays on the map, dimmed.
            </p>
            <div className="relative mt-2.5 flex items-center gap-1.5">
              <button
                type="button"
                className={BTN_QUIET_ACCENT}
                onClick={() => {
                  setOpen(null);
                  void actions.startBeat(concept.id, exchangeId);
                }}
                data-testid="chip-beat"
              >
                Take a beat
              </button>
              <Hint text={HINTS.beat} label="What is a beat?" className={HINT_IN_ROW} />
            </div>
          </div>
        </div>
      ) : null}
    </span>
  );
}
