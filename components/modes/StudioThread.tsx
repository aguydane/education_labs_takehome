"use client";

/**
 * The Studio conversation. Assistant turns render as markdown, the learner's
 * turns sit on the right, and rung changes read as a quiet system line.
 * Sticks to the bottom while new text arrives unless the learner scrolls up.
 */

import { useEffect, useRef } from "react";
import { STUDIO_OPENING_USER } from "@/lib/pipeline/practice";
import type { StudioMessage } from "@/lib/types";
import Markdown from "./Markdown";
import { describeRungNote, isRungNote } from "./ui";

type Props = {
  messages: StudioMessage[];
  streaming: boolean;
  partial: string;
};

export default function StudioThread({ messages, streaming, partial }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  /** Whether to follow new text; off once the learner scrolls up to reread. */
  const stickRef = useRef(true);
  const seenRef = useRef(messages.length);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const grew = messages.length > seenRef.current;
    seenRef.current = messages.length;
    // The learner just said something (or moved a rung): follow the reply.
    if (grew && messages[messages.length - 1]?.role === "user") stickRef.current = true;
    if (stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, partial, streaming]);

  const visible = messages
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => !(i === 0 && m.role === "user" && m.content.trim() === STUDIO_OPENING_USER));

  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      data-testid="studio-messages"
      className="min-h-0 flex-1 overflow-y-auto"
      role="log"
      aria-label="Studio conversation"
      aria-busy={streaming || undefined}
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-4 py-4">
        {visible.length === 0 && !streaming ? (
          <p className="py-6 text-center text-xs text-ink-2">Claude opens the session on your own work.</p>
        ) : null}

        {visible.map(({ m, i }) => {
          if (m.role === "user" && isRungNote(m.content)) {
            return (
              <p key={i} data-role="system" className="flex items-center gap-3 py-1 text-xs text-ink-2">
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
                className="ml-auto max-w-[80%] whitespace-pre-wrap break-words rounded-lg bg-accent-soft px-3 py-2 text-sm text-ink"
              >
                {m.content}
              </div>
            );
          }
          return (
            <div key={i} data-role="assistant" className="rounded-lg border border-rule bg-panel px-4 py-2.5">
              <Markdown text={m.content} />
            </div>
          );
        })}

        {streaming ? (
          <div data-role="assistant" data-streaming="true" className="rounded-lg border border-rule bg-panel px-4 py-2.5">
            <Markdown text={partial} streaming />
          </div>
        ) : null}
      </div>
    </div>
  );
}
