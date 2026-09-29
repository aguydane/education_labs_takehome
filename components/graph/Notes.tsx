"use client";

import { useId, useState } from "react";
import Hint from "@/components/ui/Hint";
import type { Note } from "@/lib/types";
import { HINTS } from "./hints";
import { CloseIcon } from "./icons";
import { BTN, fmtDate } from "./shared";

/**
 * The learner's journal on an idea or a link: dated notes, oldest first, and
 * a box to add the next one (Cmd/Ctrl+Enter adds it).
 */
export default function Notes({
  notes,
  onAdd,
  onRemove,
  testPrefix,
}: {
  notes: Note[];
  onAdd: (text: string) => void;
  onRemove: (noteId: string) => void;
  /** "detail" or "edge": testids become `${prefix}-note-input` and so on. */
  testPrefix: "detail" | "edge";
}) {
  const [draft, setDraft] = useState("");
  const inputId = useId();

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft("");
  };

  return (
    <section>
      <h4 className="flex items-center gap-1.5 text-xs font-medium text-ink-2">
        <span>
          Your notes<span className="font-normal"> · {notes.length}</span>
        </span>
        <Hint text={HINTS.notes} label="About your notes" />
      </h4>

      {notes.length > 0 ? (
        <ul className="mt-1.5 space-y-1.5">
          {notes.map((n) => (
            <li key={n.id} data-testid={`${testPrefix}-note-${n.id}`} className="group flex items-start gap-2 text-sm">
              <span className="w-12 shrink-0 pt-px text-xs text-ink-2 tabular-nums">{fmtDate(n.ts)}</span>
              <span className="min-w-0 flex-1 whitespace-pre-wrap break-words text-ink">{n.text}</span>
              <button
                type="button"
                data-testid={`${testPrefix}-note-remove`}
                onClick={() => onRemove(n.id)}
                aria-label="Remove this note"
                title="Remove this note"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-2 hover:bg-panel-2 hover:text-ink"
              >
                <CloseIcon className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-2 space-y-1.5">
        <label htmlFor={inputId} className="sr-only">
          Add a note
        </label>
        <textarea
          id={inputId}
          data-testid={`${testPrefix}-note-input`}
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="What you understand now, or what still puzzles you…"
          className="block w-full resize-y rounded-md border border-rule bg-panel px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-2 focus:border-accent focus:outline-none"
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-ink-2">⌘/Ctrl + Enter to add</span>
          <button type="button" data-testid={`${testPrefix}-note-add`} className={BTN} disabled={!draft.trim()} onClick={submit}>
            Add note
          </button>
        </div>
      </div>
    </section>
  );
}
