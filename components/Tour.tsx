"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLearner } from "@/lib/learner-context";
import { TOUR_STEPS, type TourCtx } from "@/lib/tour";
import { tourStore, useTour } from "@/lib/tour-store";

const CARD_W = 360;
const PAD = 8;
const GAP = 12;

/**
 * The walkthrough engine: spotlights a live element, shows the step card
 * next to it, and advances when the step's condition is met in real state.
 * It never blocks the page; the dimming is visual only.
 */
export default function Tour() {
  const learner = useLearner();
  const tour = useTour();
  const [tick, setTick] = useState(0);
  const [cardH, setCardH] = useState(260);
  const cardRef = useRef<HTMLDivElement>(null);

  // Re-evaluate anchors and conditions a few times a second while active,
  // and measure the card so it can be kept inside the viewport.
  useEffect(() => {
    if (!tour.active) return;
    const id = setInterval(() => {
      setTick((t) => t + 1);
      const h = cardRef.current?.offsetHeight;
      if (h) setCardH(h);
    }, 300);
    return () => clearInterval(id);
  }, [tour.active]);

  const ctx = useMemo<TourCtx>(
    () => ({
      state: learner.state,
      beat: learner.beat,
      studio: learner.studio,
      busy: learner.busy,
      startedAt: tour.startedAt ?? "9999",
      dom: (sel) => document.querySelector(sel),
      domAll: (sel) => Array.from(document.querySelectorAll(sel)),
    }),
    // tick forces a fresh DOM read
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [learner.state, learner.beat, learner.studio, learner.busy, tour.startedAt, tick],
  );

  const step = TOUR_STEPS[tour.stepIndex];
  const isLast = tour.stepIndex === TOUR_STEPS.length - 1;

  // Skip steps whose skipWhen says so; auto-advance on advanceWhen.
  useEffect(() => {
    if (!tour.active || !step) return;
    if (step.skipWhen?.(ctx)) {
      if (isLast) tourStore.finish();
      else tourStore.next();
      return;
    }
    if (step.advanceWhen?.(ctx)) {
      if (isLast) tourStore.finish();
      else tourStore.next();
    }
  }, [ctx, step, tour.active, isLast]);

  // Bring the anchor into view when a step starts.
  const anchor = tour.active && step?.anchor ? step.anchor(ctx) : null;
  const anchorEl = anchor instanceof Element ? anchor : null;
  const scrolledFor = useRef<string | null>(null);
  useEffect(() => {
    if (!anchorEl || !step) return;
    if (scrolledFor.current === step.id) return;
    scrolledFor.current = step.id;
    anchorEl.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [anchorEl, step]);

  const begin = useCallback(() => {
    learner.actions.startFresh("backend");
    tourStore.begin();
  }, [learner.actions]);

  const sendScript = useCallback(
    (text: string) => {
      void learner.actions.sendWork(text);
    },
    [learner.actions],
  );

  if (!tour.active || !step) return null;

  const rawRect = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
  const vw = typeof window === "undefined" ? 1200 : window.innerWidth;
  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  // An anchor scrolled out of view gets no spotlight; the card centers instead.
  const rect = rawRect && rawRect.bottom > 0 && rawRect.top < vh && rawRect.width > 0 ? rawRect : null;
  const fallback = step.fallbackWhen?.(ctx) ?? false;
  const showNext = step.manual || fallback;

  // Card placement: beside the anchor when it's in the right column, else below/above.
  let cardStyle: React.CSSProperties;
  if (!rect) {
    cardStyle = { left: "50%", top: "50%", transform: "translate(-50%, -50%)", width: CARD_W };
  } else {
    const inRightColumn = rect.left > vw * 0.55;
    let left: number;
    let top: number;
    if (inRightColumn) {
      left = rect.left - CARD_W - GAP;
      top = rect.top;
    } else {
      left = Math.min(rect.left, vw - CARD_W - GAP);
      top = rect.bottom + GAP;
      if (top + cardH > vh) top = Math.max(GAP, rect.top - GAP - cardH);
    }
    left = Math.max(GAP, Math.min(left, vw - CARD_W - GAP));
    top = Math.max(GAP, Math.min(top, vh - GAP - cardH));
    cardStyle = { left, top, width: CARD_W };
  }

  return (
    <>
      {/* Spotlight: dims everything except the anchor. Visual only; clicks pass through. */}
      <svg
        className="pointer-events-none fixed inset-0 z-40 h-full w-full"
        aria-hidden
        data-testid="tour-spotlight"
      >
        <defs>
          <mask id="helm-tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {rect ? (
              <rect
                x={rect.left - PAD}
                y={rect.top - PAD}
                width={rect.width + PAD * 2}
                height={rect.height + PAD * 2}
                rx="10"
                fill="black"
              />
            ) : null}
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#helm-tour-mask)" />
        {rect ? (
          <rect
            x={rect.left - PAD}
            y={rect.top - PAD}
            width={rect.width + PAD * 2}
            height={rect.height + PAD * 2}
            rx="10"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
          />
        ) : null}
      </svg>

      <div
        ref={cardRef}
        role="dialog"
        aria-labelledby="tour-title"
        data-testid="tour-card"
        data-step={step.id}
        style={cardStyle}
        className="fixed z-50 rounded-xl border border-rule bg-panel p-4 text-sm shadow-xl"
      >
        <div className="flex items-baseline gap-2">
          <span className="text-[11px] uppercase tracking-wide text-ink-2">
            {tour.stepIndex === 0 ? "Walkthrough" : `Step ${tour.stepIndex} of ${TOUR_STEPS.length - 1}`}
          </span>
          <button
            type="button"
            onClick={() => tourStore.finish()}
            className="ml-auto text-xs text-ink-2 hover:text-ink"
            data-testid="tour-skip"
          >
            {tour.stepIndex === 0 ? "Not now" : "Skip walkthrough"}
          </button>
        </div>
        <h2 id="tour-title" className="mt-1 font-semibold">
          {step.title}
        </h2>
        <p className="mt-1 leading-relaxed text-ink-2">{step.body}</p>

        {step.script ? (
          <div className="mt-3 rounded-md border border-rule bg-panel-2 p-3">
            <p className="text-xs text-ink-2">Maya&apos;s message</p>
            <p className="mt-1 text-ink">{step.script.text}</p>
            <div className="mt-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => sendScript(step.script!.text)}
                disabled={learner.busy.chat}
                className="rounded-md bg-accent px-3 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                data-testid="tour-send"
              >
                Send this
              </button>
              <span className="text-xs text-ink-2">or write your own</span>
            </div>
          </div>
        ) : null}

        {fallback && step.fallbackText ? (
          <p className="mt-3 rounded-md bg-warn-soft px-3 py-2 text-xs text-warn">{step.fallbackText}</p>
        ) : step.waiting && !step.manual ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-ink-2" data-testid="tour-waiting">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            {step.waiting}
          </p>
        ) : null}

        {showNext ? (
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => {
                if (tour.stepIndex === 0) begin();
                else if (isLast) tourStore.finish();
                else tourStore.next();
              }}
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
              data-testid={tour.stepIndex === 0 ? "tour-start" : isLast ? "tour-finish" : "tour-next"}
            >
              {step.nextLabel ?? "Next"}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
