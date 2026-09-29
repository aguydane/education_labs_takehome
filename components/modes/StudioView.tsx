"use client";

/**
 * Studio: dedicated, protected, state-saved time on one concept. Replaces the
 * work panel while open. The "where you were" card keeps the saved work in
 * view, and "Back to work" asks for the one-sentence closing statement.
 */

import { Fragment, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Hint from "@/components/ui/Hint";
import { useLearner } from "@/lib/learner-context";
import type { StudioSession } from "@/lib/types";
import RungControl from "./RungControl";
import StudioThread from "./StudioThread";
import {
  COMPOSER_PLACEHOLDER,
  ENTRY_LABEL,
  ENTRY_TITLE,
  HINTS,
  SUMMARY_LABELS,
  btnLink,
  btnPrimary,
  btnQuiet,
  field,
  guessClosingSentence,
  summaryLines,
} from "./ui";

const CLOSING_QUESTION =
  "In one sentence, what would you now specify differently in a prompt about this kind of work?";

export default function StudioView() {
  const { state, studio, actions } = useLearner();
  const session = state.studioSessions.find((s) => s.id === (studio?.sessionId || state.ui.activeStudioId));

  if (!session) {
    return (
      <section
        data-testid="studio-view"
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center"
      >
        <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink">Studio</span>
        <p className="text-sm text-ink-2">
          {studio?.entering ? "Saving where you were…" : "There's no open studio session."}
        </p>
        {studio?.error ? <p className="text-sm text-warn">{studio.error}</p> : null}
        <button type="button" onClick={() => actions.leaveStudio()} data-testid="studio-back" className={btnQuiet}>
          Back to work
        </button>
      </section>
    );
  }

  // Keyed so drafts and the close form belong to one session.
  return <StudioSessionView key={session.id} session={session} />;
}

function StudioSessionView({ session }: { session: StudioSession }) {
  const { state, studio, actions } = useLearner();
  const [closing, setClosing] = useState(false);
  const [closingDraft, setClosingDraft] = useState("");
  const backRef = useRef<HTMLButtonElement>(null);
  const formId = useId();

  const conceptName = state.concepts[session.conceptId]?.name ?? "this concept";
  const entryLabel = ENTRY_LABEL[session.entry];
  // The provider can only take turns for the session it is tracking; if it
  // tracks another (or none), the thread stays readable but can't continue.
  const live = studio?.sessionId === session.id;
  const streaming = !!studio?.streaming && live;
  const entering = !!studio?.entering;
  const locked = !live || streaming || entering;
  const error = live ? studio?.error : undefined;

  const lines = session.workSummary ? summaryLines(session.workSummary) : [];
  const saving = lines.length === 0 && entering;
  const showCard = lines.length > 0 || saving;

  const openClose = () => {
    setClosingDraft((d) => d || guessClosingSentence(session.messages));
    setClosing(true);
  };

  const cancelClose = () => {
    setClosing(false);
    backRef.current?.focus();
  };

  const backButton = (
    <button
      ref={backRef}
      type="button"
      onClick={openClose}
      aria-expanded={closing}
      aria-controls={formId}
      data-testid="studio-back"
      className={`shrink-0 ${btnQuiet}`}
    >
      Back to work
    </button>
  );

  const closingForm = closing ? (
    <ClosingForm
      id={formId}
      draft={closingDraft}
      setDraft={setClosingDraft}
      onClose={(sentence) => actions.leaveStudio(sentence)}
      onLeave={() => actions.leaveStudio()}
      onCancel={cancelClose}
    />
  ) : null;

  return (
    <section data-testid="studio-view" className="flex min-h-0 flex-1 flex-col bg-bg">
      <header className="shrink-0 border-b border-rule bg-panel px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent-ink">Studio</span>
          <Hint text={HINTS.studio} label="About Studio" className="shrink-0" />
          <h2 className="min-w-0 truncate text-sm font-semibold text-ink">{conceptName}</h2>
          {entryLabel ? (
            <span
              data-testid="studio-entry"
              title={ENTRY_TITLE[session.entry]}
              className="shrink-0 rounded-full border border-rule px-2 py-0.5 text-xs text-ink-2"
            >
              {entryLabel}
            </span>
          ) : null}
          {showCard ? null : <div className="ml-auto">{backButton}</div>}
        </div>
        <div className="mt-2">
          <RungControl
            rung={session.rung}
            locked={locked}
            onMoreHelp={() => void actions.changeRung("more-help")}
            onLetMeTry={() => void actions.changeRung("let-me-try")}
          />
        </div>
      </header>

      {showCard ? (
        <div className="shrink-0 px-4 pt-3">
          <div data-testid="studio-summary" className="mx-auto max-w-3xl rounded-lg border border-rule bg-panel-2 px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-medium text-ink-2">Where you were</p>
                  <Hint text={HINTS.whereYouWere} label="About this card" />
                </div>
                {saving ? (
                  <p className="mt-1 animate-pulse text-sm text-ink-2">Saving where you were{"…"}</p>
                ) : lines.length === SUMMARY_LABELS.length ? (
                  <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                    {lines.map((line, i) => (
                      <Fragment key={i}>
                        <dt className="pt-0.5 text-xs text-ink-2">{SUMMARY_LABELS[i]}</dt>
                        <dd className="text-sm text-ink">{line}</dd>
                      </Fragment>
                    ))}
                  </dl>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    {lines.map((line, i) => (
                      <p key={i} className="text-sm text-ink">
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </div>
              {backButton}
            </div>
            {closingForm}
          </div>
        </div>
      ) : closingForm ? (
        <div className="shrink-0 px-4 pt-3">
          <div className="mx-auto max-w-3xl rounded-lg border border-rule bg-panel-2 px-4 py-3">{closingForm}</div>
        </div>
      ) : null}

      <StudioThread messages={session.messages} streaming={streaming} partial={live ? (studio?.partial ?? "") : ""} />

      <div className="shrink-0 border-t border-rule bg-panel px-4 py-3">
        <div className="mx-auto max-w-3xl">
          {error ? (
            <p role="alert" className="mb-2 rounded-md bg-warn-soft px-3 py-2 text-sm text-warn">
              Claude didn&apos;t reply: {error}. Sending a message tries again.
            </p>
          ) : null}
          {!live && !entering ? (
            <p className="mb-2 text-xs text-ink-2">
              Claude isn&apos;t attached to this session right now. Use Back to work to close it.
            </p>
          ) : null}
          <Composer
            placeholder={COMPOSER_PLACEHOLDER[session.rung]}
            disabled={locked}
            onSend={(text) => void actions.sendStudio(text)}
          />
        </div>
      </div>
    </section>
  );
}

function ClosingForm({
  id,
  draft,
  setDraft,
  onClose,
  onLeave,
  onCancel,
}: {
  id: string;
  draft: string;
  setDraft: (v: string) => void;
  onClose: (sentence: string) => void;
  onLeave: () => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const sentence = draft.trim();
    if (!sentence) {
      inputRef.current?.focus();
      return;
    }
    onClose(sentence);
  };

  return (
    <form id={id} onSubmit={submit} className="mt-3 border-t border-rule pt-3">
      <label htmlFor={inputId} className="block text-sm text-ink">
        {CLOSING_QUESTION}
      </label>
      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
        autoComplete="off"
        placeholder="One sentence"
        data-testid="studio-closing-input"
        className={`mt-2 ${field}`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <button type="submit" data-testid="studio-closing-submit" className={btnPrimary}>
          Close session
        </button>
        <button type="button" onClick={onLeave} data-testid="studio-leave" className={btnLink}>
          Leave without closing
        </button>
        <button type="button" onClick={onCancel} className={`ml-auto ${btnLink}`}>
          Keep going
        </button>
      </div>
    </form>
  );
}

function Composer({
  placeholder,
  disabled,
  onSend,
}: {
  placeholder: string;
  disabled: boolean;
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();

  // Disabling the field while Claude replies drops focus; give it back
  // afterwards unless the learner has moved on to something else.
  useEffect(() => {
    if (disabled) return;
    const active = document.activeElement;
    if (!active || active === document.body) ref.current?.focus({ preventScroll: true });
  }, [disabled]);

  const send = () => {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
      className="flex items-end gap-2"
    >
      <label htmlFor={inputId} className="sr-only">
        Message Claude
      </label>
      <textarea
        ref={ref}
        id={inputId}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
          }
        }}
        rows={Math.min(6, Math.max(2, text.split("\n").length))}
        disabled={disabled}
        placeholder={placeholder}
        data-testid="studio-composer"
        className={`resize-none ${field}`}
      />
      <button type="submit" disabled={disabled} data-testid="studio-send" className={`shrink-0 ${btnPrimary}`}>
        Send
      </button>
    </form>
  );
}
