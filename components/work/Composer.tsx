"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import Hint from "@/components/ui/Hint";
import { BTN_ACCENT, BTN_QUIET, HINTS, HINT_IN_ROW_ABOVE } from "./helpers";

export default function Composer({
  busy,
  longTaskRunning,
  onSend,
  onKickOff,
}: {
  busy: boolean;
  longTaskRunning: boolean;
  onSend: (text: string) => void;
  onKickOff: () => void;
}) {
  const [text, setText] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with the content up to the max-height (~6 lines), then scroll.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [text]);

  const canSend = !busy && text.trim().length > 0;

  const send = () => {
    if (!canSend) return;
    onSend(text);
    setText("");
    ref.current?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="shrink-0 border-t border-rule bg-panel px-5 pb-3 pt-3">
      <form
        className="mx-auto flex w-full max-w-3xl flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor="work-composer" className="sr-only">
          Message Claude
        </label>
        <textarea
          id="work-composer"
          ref={ref}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask Claude to do something…"
          className={`max-h-[8.75rem] min-h-[2.5rem] w-full resize-none overflow-y-auto rounded-lg border border-rule bg-bg px-3 py-2 text-sm leading-5 text-ink placeholder:text-ink-2 outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30`}
          data-testid="work-composer"
        />
        <div className="relative flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
          <button
            type="button"
            className={BTN_QUIET}
            onClick={onKickOff}
            disabled={busy || longTaskRunning}
            title={longTaskRunning ? "A long task is already running" : undefined}
            data-testid="work-longtask"
          >
            Kick off long task
          </button>
          <Hint text={HINTS.longTask} label="What does this do?" className={HINT_IN_ROW_ABOVE} />
          </span>
          <span className="ml-auto hidden text-xs text-ink-2 md:inline">Enter to send · Shift+Enter for a new line</span>
          <button
            type="submit"
            className={`${BTN_ACCENT} inline-flex items-center gap-1.5`}
            disabled={busy}
            aria-busy={busy}
            data-testid="work-send"
          >
            {busy ? (
              <>
                <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-panel" />
                Replying…
              </>
            ) : (
              "Send"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
