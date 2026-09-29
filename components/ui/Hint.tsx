"use client";

import { useId, useState, type ReactNode } from "react";

/**
 * A small "?" that explains the thing next to it. Hover or focus shows the
 * text; click pins it open. Used across panels so explanations look and
 * behave the same everywhere.
 */
export default function Hint({
  text,
  label = "What is this?",
  className = "",
  children,
}: {
  text: ReactNode;
  label?: string;
  className?: string;
  /** Optional inline trigger instead of the default "?" glyph. */
  children?: ReactNode;
}) {
  const [pinned, setPinned] = useState(false);
  const [hover, setHover] = useState(false);
  const id = useId();
  const open = pinned || hover;

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setPinned((p) => !p)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => {
          setHover(false);
          setPinned(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setPinned(false);
        }}
        data-testid="hint"
        className={
          children
            ? "text-ink-2 underline decoration-dotted underline-offset-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            : "inline-flex h-4 w-4 items-center justify-center rounded-full border border-rule text-[10px] leading-none text-ink-2 hover:border-ink-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        }
      >
        {children ?? "?"}
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          data-testid="hint-text"
          className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-rule bg-panel px-3 py-2 text-xs font-normal leading-relaxed text-ink shadow-lg"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
