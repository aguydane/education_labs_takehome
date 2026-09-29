"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useLearner } from "@/lib/learner-context";
import Hint from "@/components/ui/Hint";
import type { Recognition } from "@/lib/types";
import styles from "./graph.module.css";
import { CloseIcon } from "./icons";
import { HINTS } from "./hints";
import ShowInChat from "./ShowInChat";
import Connections from "./Connections";
import { BTN, BTN_ON, ICON_BTN, STATE_LABEL, fmtDate } from "./shared";
import StateDot from "./StateDot";

const REJECT_LABEL: Record<NonNullable<Recognition["rejectReason"]>, string> = {
  copied: "copied",
  "already-knew": "already knew it",
  "not-the-concept": "not this concept",
};

function Section({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <section>
      <h4 className="text-xs font-medium text-ink-2">
        {title}
        {count !== undefined ? <span className="font-normal"> · {count}</span> : null}
      </h4>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-xs text-ink-2">{children}</p>;
}

/** Everything Helm has recorded about one concept, and the learner's controls over it. */
export default function ConceptDetail({
  headerAction,
  conceptId,
  onSelectConcept,
  onClose,
}: {
  conceptId: string;
  onSelectConcept: (id: string) => void;
  onClose: () => void;
  /** Optional control shown in the header row (the dock's "Expand"). */
  headerAction?: ReactNode;
}) {
  const { state, studio, actions } = useLearner();
  const rootRef = useRef<HTMLDivElement>(null);

  // Bring the detail into view inside the dock (not the whole panel) when it opens.
  useEffect(() => {
    const el = rootRef.current;
    const dock = el?.parentElement;
    if (!el || !dock) return;
    dock.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, []);

  const c = state.concepts[conceptId];
  if (!c) return null;

  const { conceptIds, size } = state.activeSet;
  const inActive = conceptIds.includes(c.id);
  const atCap = conceptIds.length >= size;
  const delegated = c.state === "delegated";
  const knowOn = c.confidenceSource === "learner" && c.confidence === "high";
  const dontOn = c.confidenceSource === "learner" && c.confidence === "low";
  const studioBlocked = state.ui.mode === "studio" || !!studio?.entering;

  let activeBlocked: string | null = null;
  if (!inActive && delegated) activeBlocked = "Bring it back before adding it to the active set.";
  else if (!inActive && atCap) activeBlocked = `The active set holds ${size}. Remove one to make room.`;

  const toggleActive = () => {
    if (inActive) actions.chooseActiveSet(conceptIds.filter((x) => x !== c.id));
    else if (!activeBlocked) actions.chooseActiveSet([...conceptIds, c.id]);
  };

  // Only offer "Show in chat" for exchanges that are still in the history.
  const inChat = new Set(state.exchanges.map((x) => x.id));
  const evidence = [...c.evidence].reverse();
  const practice = [...c.practiceLog].reverse();
  const recognitions = [...c.recognitions].reverse();

  return (
    <section
      ref={rootRef}
      data-testid="concept-detail"
      aria-label={c.name}
      className={`border-t border-rule bg-panel ${styles.sheet}`}
    >
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-rule bg-panel px-4 pb-2.5 pt-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-ink">{c.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-panel-2 px-2 py-0.5 text-ink">
              <StateDot state={c.state} />
              {STATE_LABEL[c.state]}
            </span>
            {inActive ? <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent-ink">active</span> : null}
            {c.pinned ? <span className="rounded-full bg-panel-2 px-2 py-0.5 text-ink-2">pinned</span> : null}
          </div>
        </div>
        {headerAction}
        <button type="button" data-testid="detail-close" onClick={onClose} aria-label="Close" title="Close" className={ICON_BTN}>
          <CloseIcon />
        </button>
      </header>

      <div className="space-y-4 px-4 py-3">
        <div className="space-y-2">
          {c.summary ? <p className="text-sm text-ink">{c.summary}</p> : null}
          {c.whyItMatters ? (
            <p className="text-sm text-ink-2">
              <span className="text-ink">Why it matters: </span>
              {c.whyItMatters}
            </p>
          ) : null}
        </div>

        <dl className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded-md bg-panel-2 px-2.5 py-1.5">
            <dt className="flex items-center gap-1.5 text-ink-2">
              Confidence
              <Hint text={HINTS.confidence} label="About confidence" />
            </dt>
            <dd className="text-ink">
              {c.confidence}
              <span className="text-ink-2">{c.confidenceSource === "learner" ? " · you said" : " · estimated"}</span>
            </dd>
          </div>
          <div className="rounded-md bg-panel-2 px-2.5 py-1.5">
            <dt className="text-ink-2">Impact</dt>
            <dd className="text-ink tabular-nums">{c.impact}/5</dd>
          </div>
          <div className="rounded-md bg-panel-2 px-2.5 py-1.5">
            <dt className="text-ink-2">In your work</dt>
            <dd className="text-ink tabular-nums">seen {c.timesSeen}×</dd>
          </div>
        </dl>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-testid="detail-know"
              aria-pressed={knowOn}
              className={`${BTN} ${knowOn ? BTN_ON : ""}`}
              onClick={() => actions.judgeConcept(c.id, "know")}
            >
              I know this
            </button>
            <button
              type="button"
              data-testid="detail-dont"
              aria-pressed={dontOn}
              className={`${BTN} ${dontOn ? BTN_ON : ""}`}
              onClick={() => actions.judgeConcept(c.id, "dont")}
            >
              I don&apos;t
            </button>
            <button
              type="button"
              data-testid="detail-delegate"
              className={BTN}
              onClick={() => actions.judgeConcept(c.id, delegated ? "undelegate" : "delegate")}
              title={delegated ? "Start tracking this again" : "Let Claude keep handling this; stop nudging about it"}
            >
              {delegated ? "Bring back" : "Keep delegating"}
            </button>
            <Hint text={HINTS.delegate} label="About delegating" className="self-center" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              data-testid="detail-pin"
              aria-pressed={c.pinned}
              className={`${BTN} ${c.pinned ? BTN_ON : ""}`}
              disabled={delegated}
              onClick={() => actions.pinConcept(c.id, !c.pinned)}
              title="A curiosity pin keeps this in view regardless of ranking"
            >
              {c.pinned ? "Pinned" : "Pin"}
            </button>
            <button
              type="button"
              data-testid="detail-toggle-active"
              className={BTN}
              disabled={!!activeBlocked}
              aria-describedby={activeBlocked ? `active-why-${c.id}` : undefined}
              onClick={toggleActive}
            >
              {inActive ? "Remove from active set" : "Add to active set"}
            </button>
            <button
              type="button"
              data-testid="detail-studio"
              className={BTN}
              disabled={studioBlocked}
              onClick={() => void actions.enterStudio({ conceptId: c.id, entry: "manual" })}
            >
              Book studio time
            </button>
          </div>
          {activeBlocked ? (
            <p id={`active-why-${c.id}`} className="text-xs text-ink-2">
              {activeBlocked}
            </p>
          ) : null}
        </div>

        <Connections conceptId={c.id} onSelectConcept={onSelectConcept} />

        <Section title="In your words" count={evidence.length}>
          {evidence.length === 0 ? (
            <Empty>No quotes recorded yet.</Empty>
          ) : (
            <ul className="space-y-2">
              {evidence.map((e, i) => (
                <li key={`${e.exchangeId}-${i}`}>
                  <blockquote className="border-l-2 border-rule pl-2.5 text-sm text-ink">&ldquo;{e.quote}&rdquo;</blockquote>
                  <p className="mt-0.5 pl-3 text-xs text-ink-2">
                    {fmtDate(e.ts)}
                    {e.note ? ` · ${e.note}` : ""}
                    {inChat.has(e.exchangeId) ? (
                      <>
                        {" · "}
                        <ShowInChat testId="detail-show-in-chat" onClick={() => actions.revealExchange(e.exchangeId)} />
                      </>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="What it looks like when you have it">
          {c.rubric.length === 0 ? (
            <Empty>No rubric yet.</Empty>
          ) : (
            <ul className="list-disc space-y-1 pl-4 text-sm text-ink">
              {c.rubric.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Practice" count={practice.length}>
          {practice.length === 0 ? (
            <Empty>Not practiced yet.</Empty>
          ) : (
            <ul className="space-y-1.5">
              {practice.map((p, i) => (
                <li key={`${p.ts}-${i}`} className="text-sm text-ink">
                  <span className="text-xs text-ink-2">
                    {fmtDate(p.ts)} · {p.mode === "studio" ? "Studio" : "Beat"} · {p.rung}
                  </span>
                  {p.note ? <p>{p.note}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recognitions" count={recognitions.length}>
          {recognitions.length === 0 ? (
            <Empty>None yet. When your own prompts show this in use, Claude will point it out and you decide.</Empty>
          ) : (
            <ul className="space-y-2">
              {recognitions.map((r) => (
                <li key={r.id}>
                  <p className="text-xs text-ink-2">
                    {fmtDate(r.ts)} ·{" "}
                    <span className={r.status === "confirmed" ? "text-ok" : r.status === "rejected" ? "" : "text-warn"}>
                      {r.status}
                      {r.status === "rejected" && r.rejectReason ? ` (${REJECT_LABEL[r.rejectReason]})` : ""}
                    </span>
                    {inChat.has(r.exchangeId) ? (
                      <>
                        {" · "}
                        <ShowInChat
                          testId="detail-recognition-show-in-chat"
                          onClick={() => actions.revealExchange(r.exchangeId)}
                        />
                      </>
                    ) : null}
                  </p>
                  <blockquote className="mt-0.5 border-l-2 border-rule pl-2.5 text-sm text-ink">&ldquo;{r.quote}&rdquo;</blockquote>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </section>
  );
}
