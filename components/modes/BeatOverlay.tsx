"use client";

/**
 * Beat: a two-to-five-minute aside inside work. Claude explains the why
 * behind what was just done, ends with one question, and gets out of the way.
 * Leaving is one click (or Escape) at every point.
 */

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useLearner, type BeatUI } from "@/lib/learner-context";
import Markdown from "./Markdown";
import { btnLink, btnPrimary, field, focusRing } from "./ui";

export default function BeatOverlay() {
  const { beat } = useLearner();
  if (!beat) return null;
  // Keyed so a new beat starts with a fresh answer field.
  return <BeatCard key={`${beat.exchangeId}:${beat.conceptId}`} beat={beat} />;
}

function BeatCard({ beat }: { beat: BeatUI }) {
  const { state, studio, actions } = useLearner();
  const [answer, setAnswer] = useState("");
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  const concept = state.concepts[beat.conceptId];
  const conceptName = concept?.name ?? "this concept";
  const streaming = beat.status === "streaming";
  // Without a recorded beat (e.g. the call failed) there is nothing to attach an answer to.
  const canAnswer = beat.status === "ready" && !!beat.beatId && !beat.error;
  const answered = beat.status === "answered";
  const savedAnswer = answered ? state.beats.find((b) => b.id === beat.beatId)?.answer : undefined;
  const { closeBeat } = actions;

  // Escape closes the beat from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) closeBeat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeBeat]);

  // Bring keyboard focus into the aside when it opens.
  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  // When the question is ready, put the cursor in the answer field unless
  // the learner has moved focus somewhere else in the meantime.
  useEffect(() => {
    if (!canAnswer) return;
    const active = document.activeElement;
    if (!active || active === document.body || cardRef.current?.contains(active)) {
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [canAnswer]);

  // Keep the newest streamed text in view.
  useEffect(() => {
    const el = contentRef.current;
    if (el && streaming) el.scrollTop = el.scrollHeight;
  }, [beat.content, streaming]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = answer.trim();
    if (!text) {
      inputRef.current?.focus();
      return;
    }
    if (!canAnswer) return;
    actions.answerBeat(text);
  };

  const bookStudio = () => {
    void actions.enterStudio({ conceptId: beat.conceptId, entry: "manual" });
    actions.closeBeat();
  };

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      data-testid="beat-overlay"
      data-status={beat.status}
      className="absolute inset-x-4 bottom-4 z-20 mx-auto flex max-h-[calc(100%-2rem)] max-w-2xl flex-col overflow-hidden rounded-xl border border-rule bg-panel shadow-lg outline-none"
    >
      <div className="flex shrink-0 items-center gap-2 border-b border-rule px-4 py-2">
        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink">Beat</span>
        <h2 id={titleId} className="min-w-0 truncate text-sm font-medium text-ink">
          {conceptName}
        </h2>
        <button
          type="button"
          onClick={closeBeat}
          aria-label="Close beat and go back to work"
          title="Back to work (Esc)"
          data-testid="beat-close"
          className={`ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-base leading-none text-ink-2 hover:bg-panel-2 hover:text-ink ${focusRing}`}
        >
          <span aria-hidden>{"×"}</span>
        </button>
      </div>

      <div
        ref={contentRef}
        data-testid="beat-content"
        className="min-h-0 overflow-y-auto px-4 py-3"
        aria-live="polite"
        aria-busy={streaming || undefined}
      >
        {beat.content || streaming ? <Markdown text={beat.content} streaming={streaming} /> : null}
        {beat.error ? (
          <p className="mt-2 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn" role="alert">
            The beat didn&apos;t come through: {beat.error}
          </p>
        ) : null}
      </div>

      {canAnswer ? (
        <form onSubmit={submit} className="flex shrink-0 items-center gap-2 border-t border-rule px-4 py-3">
          <label htmlFor={`${titleId}-answer`} className="sr-only">
            Your answer, in one sentence
          </label>
          <input
            ref={inputRef}
            id={`${titleId}-answer`}
            type="text"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="One sentence"
            autoComplete="off"
            data-testid="beat-answer"
            className={field}
          />
          <button type="submit" data-testid="beat-reply" className={`shrink-0 ${btnPrimary}`}>
            Reply
          </button>
        </form>
      ) : null}

      {answered ? (
        <div className="shrink-0 border-t border-rule px-4 py-3">
          {savedAnswer ? (
            <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink">{savedAnswer}</p>
          ) : null}
          <p className="mt-2 text-sm text-ink-2">Noted.</p>
        </div>
      ) : null}

      <div className="flex shrink-0 items-center gap-3 px-4 pb-3 pt-1">
        {answered ? (
          <>
            <button type="button" onClick={closeBeat} className={btnPrimary}>
              Back to work
            </button>
            <button
              type="button"
              onClick={bookStudio}
              disabled={!!studio?.entering}
              data-testid="beat-studio"
              className={`${btnLink} disabled:opacity-40`}
            >
              Book studio time on this
            </button>
          </>
        ) : (
          <button type="button" onClick={closeBeat} className={btnLink}>
            Back to work
          </button>
        )}
        <span className="ml-auto hidden text-xs text-ink-2 sm:inline">Esc to close</span>
      </div>
    </div>
  );
}
