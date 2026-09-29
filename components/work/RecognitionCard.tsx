"use client";

import { useState } from "react";
import Hint from "@/components/ui/Hint";
import type { RecognitionDecision } from "@/lib/pipeline/recognize";
import type { Concept, Recognition, RejectReason } from "@/lib/types";
import { BTN_QUIET, BTN_QUIET_ACCENT, HINTS, HINT_IN_ROW } from "./helpers";

const REASONS: { reason: RejectReason; label: string }[] = [
  { reason: "copied", label: "I copied a pattern I'd seen" },
  { reason: "already-knew", label: "I already knew this" },
  { reason: "not-the-concept", label: "That's not the concept" },
];

/** Informational: Claude proposes, the learner judges. */
export default function RecognitionCard({
  recognition,
  concept,
  underlined,
  onJudge,
}: {
  recognition: Recognition;
  concept: Concept;
  /** The quote was found in the message above and is underlined there. */
  underlined: boolean;
  onJudge: (recognitionId: string, decision: RecognitionDecision) => void;
}) {
  const [rejecting, setRejecting] = useState(false);

  return (
    <div
      role="group"
      aria-label={`Evidence you understand ${concept.name}`}
      className="w-full max-w-[85%] rounded-lg border border-rule bg-panel px-3.5 py-3 text-left"
      data-testid={`recognition-${recognition.id}`}
    >
      <p className="relative flex items-center gap-1.5 text-xs text-ink-2">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-st-practicing" />
        <span>
          Evidence you understand <span className="font-medium text-ink">{concept.name}</span>
        </span>
        <Hint text={HINTS.recognition} label="How does Helm decide this?" className={HINT_IN_ROW} />
      </p>
      <figure className="mt-2">
        <blockquote className="border-l-2 border-st-practicing pl-3 text-sm leading-snug text-ink">
          &ldquo;{recognition.quote}&rdquo;
        </blockquote>
        <figcaption className="mt-1 pl-3.5 text-[11px] text-ink-2">
          {underlined ? "Your words, underlined in the message above" : "Your words, from the message above"}
        </figcaption>
      </figure>
      <p className="mt-2 text-sm leading-snug text-ink-2">{recognition.explanation}</p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={BTN_QUIET_ACCENT}
          onClick={() => onJudge(recognition.id, "confirm")}
          data-testid="recognition-confirm"
        >
          Yes, that was me
        </button>
        <button
          type="button"
          className={BTN_QUIET}
          aria-expanded={rejecting}
          onClick={() => setRejecting((v) => !v)}
          data-testid="recognition-reject"
        >
          Not really
        </button>
      </div>

      {rejecting ? (
        <div className="mt-3 border-t border-rule pt-2.5">
          <p className="text-xs text-ink-2">Which is closer?</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {REASONS.map(({ reason, label }) => (
              <button
                key={reason}
                type="button"
                className={BTN_QUIET}
                onClick={() => onJudge(recognition.id, reason)}
                data-testid={`recognition-reason-${reason}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
