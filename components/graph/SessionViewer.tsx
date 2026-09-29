"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Markdown from "@/components/modes/Markdown";
import { describeRungNote, isRungNote, summaryLines } from "@/components/modes/ui";
import { useLearner } from "@/lib/learner-context";
import { STUDIO_OPENING_USER } from "@/lib/pipeline/practice";
import styles from "./graph.module.css";
import { CloseIcon } from "./icons";
import ShowInChat from "./ShowInChat";
import StateDot from "./StateDot";
import { BTN, BTN_PRIMARY, ENTRY_WORDS, ICON_BTN, fmtDate } from "./shared";

/**
 * A past Studio session, read-only: where the learner was, the thread, and
 * what they said they'd now specify differently. From here they can pick the
 * session back up or book fresh time on the same idea.
 */
export default function SessionViewer({
  sessionId,
  onSelectConcept,
  onClose,
  headerAction,
}: {
  sessionId: string;
  onSelectConcept: (id: string) => void;
  onClose: () => void;
  /** Optional control shown in the header row (the dock's "Expand"). */
  headerAction?: ReactNode;
}) {
  const { state, studio, actions } = useLearner();
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = rootRef.current;
    const dock = el?.parentElement;
    if (el && dock) dock.scrollTo({ top: el.offsetTop, behavior: "smooth" });
  }, []);

  const session = state.studioSessions.find((s) => s.id === sessionId);
  if (!session) return null;
  const concept = state.concepts[session.conceptId];
  const material = session.materialExchangeId
    ? state.exchanges.find((e) => e.id === session.materialExchangeId)
    : undefined;
  const entering = !!studio?.entering;
  const isOpenNow = state.ui.mode === "studio" && state.ui.activeStudioId === session.id;
  const anotherOpen = state.ui.mode === "studio" && !isOpenNow;
  const resumed = session.resumedAt?.length ?? 0;
  const thread = session.messages.filter(
    (m, i) => !(i === 0 && m.role === "user" && m.content.trim() === STUDIO_OPENING_USER),
  );
  const summary = session.workSummary ? summaryLines(session.workSummary) : [];

  return (
    <section
      ref={rootRef}
      data-testid="session-viewer"
      aria-label={`Studio session on ${concept?.name ?? "an idea"}`}
      className={`border-t border-rule bg-panel ${styles.sheet}`}
    >
      <header className="sticky top-0 z-10 flex items-start gap-3 border-b border-rule bg-panel px-4 pb-2.5 pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-2">Studio session</p>
          {concept ? (
            <button
              type="button"
              onClick={() => onSelectConcept(concept.id)}
              className="inline-flex max-w-full items-center gap-1.5 text-left text-sm font-semibold text-ink underline-offset-2 hover:underline"
            >
              <StateDot state={concept.state} />
              <span className="truncate">{concept.name}</span>
            </button>
          ) : (
            <p className="text-sm font-semibold text-ink">An idea no longer on the map</p>
          )}
          <p className="mt-0.5 text-xs text-ink-2">
            {fmtDate(session.startedAt)} · {ENTRY_WORDS[session.entry]} · {session.rung}
            {resumed > 0 ? ` · resumed ×${resumed}` : ""}
            {!session.endedAt ? " · open" : ""}
          </p>
        </div>
        {headerAction}
        <button type="button" data-testid="session-close" onClick={onClose} aria-label="Close" title="Close" className={ICON_BTN}>
          <CloseIcon />
        </button>
      </header>

      <div className="space-y-4 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {isOpenNow ? (
            <p className="text-xs text-ink-2" data-testid="session-open-now">
              This session is open in Studio right now.
            </p>
          ) : (
            <>
              <button
                type="button"
                data-testid="session-resume"
                className={BTN_PRIMARY}
                disabled={entering}
                title={anotherOpen ? "Closes your open session, then reopens this thread" : "Reopen this thread in Studio"}
                onClick={() => actions.resumeStudio(session.id)}
              >
                Continue this session
              </button>
              {concept ? (
                <button
                  type="button"
                  data-testid="session-new"
                  className={BTN}
                  disabled={entering}
                  title={anotherOpen ? "Closes your open session, then starts a new one" : undefined}
                  onClick={() => void actions.enterStudio({ conceptId: concept.id, entry: "manual" })}
                >
                  Book new studio time on this
                </button>
              ) : null}
              {anotherOpen ? (
                <span className="basis-full text-xs text-ink-2">Your open session will be closed first.</span>
              ) : null}
            </>
          )}
          {material ? (
            <span className="self-center">
              <ShowInChat testId="session-show-in-chat" onClick={() => actions.revealExchange(material.id)} />
            </span>
          ) : null}
        </div>

        {summary.length > 0 ? (
          <section>
            <h4 className="text-xs font-medium text-ink-2">Where you were</h4>
            <ul className="mt-1 space-y-0.5 text-sm text-ink">
              {summary.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h4 className="text-xs font-medium text-ink-2">The session</h4>
          {thread.length === 0 ? (
            <p className="mt-1 text-xs text-ink-2">Nothing was said in this session.</p>
          ) : (
            <div className="mt-1.5 flex flex-col gap-2.5" role="log" aria-label="Studio conversation, read-only">
              {thread.map((m, i) => {
                if (m.role === "user" && isRungNote(m.content)) {
                  return (
                    <p key={i} data-role="system" className="flex items-center gap-3 py-0.5 text-xs text-ink-2">
                      <span aria-hidden className="h-px flex-1 bg-rule" />
                      <span>{describeRungNote(m.content)}</span>
                      <span aria-hidden className="h-px flex-1 bg-rule" />
                    </p>
                  );
                }
                if (m.role === "user") {
                  return (
                    <div
                      key={i}
                      data-role="user"
                      className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink"
                    >
                      {m.content}
                    </div>
                  );
                }
                return (
                  <div key={i} data-role="assistant" className="rounded-lg border border-rule bg-panel px-3 py-2">
                    <Markdown text={m.content} />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <h4 className="text-xs font-medium text-ink-2">What you&apos;d now specify differently</h4>
          {session.closingStatement ? (
            <blockquote className="mt-1 border-l-2 border-rule pl-2.5 text-sm text-ink">
              &ldquo;{session.closingStatement}&rdquo;
            </blockquote>
          ) : (
            <p className="mt-1 text-xs text-ink-2">No closing statement.</p>
          )}
        </section>
      </div>
    </section>
  );
}
