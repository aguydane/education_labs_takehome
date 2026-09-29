"use client";

import { useEffect, useRef } from "react";

const SEEN_KEY = "helm:intro-seen";

export function introSeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return true;
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * "How Helm works": the one page that explains the product. Opens on the
 * first visit and from the header afterwards.
 */
export default function IntroOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex items-start justify-center overflow-y-auto bg-bg/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
      data-testid="intro-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-xl border border-rule bg-panel p-6 text-sm shadow-xl"
      >
        <div className="flex items-start gap-3">
          <div>
            <h2 id="intro-title" className="text-lg font-semibold">
              How Helm works
            </h2>
            <p className="mt-1 text-ink-2">
              Claude does the work. You keep the understanding. Helm runs quietly alongside ordinary work and turns
              it into a small, self-directed curriculum aimed at one thing: being able to specify, judge, and redirect
              what Claude does for you.
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            data-testid="intro-close"
            className="ml-auto rounded-md px-2 py-1 text-ink-2 hover:bg-panel-2 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            ×
          </button>
        </div>

        <ol className="mt-5 space-y-4">
          <Step n={1} title="Harvest">
            After each reply, Helm notes the ideas Claude leaned on and how sure it is that you already have them.
            It reads <em>your</em> messages only, never Claude&apos;s, and it never interrupts. The chips under a reply
            are the result; the dot is Helm&apos;s confidence in you (gray unknown, amber low, teal medium, green
            high). Open a chip to correct it, take a beat, or say <em>keep delegating</em>, which is a perfectly good
            answer for most things.
          </Step>
          <Step n={2} title="Prune">
            The map on the right is every idea your work has surfaced. Helm proposes two or three to practice, with
            its reasoning; you choose. The active set is meant to stay put for weeks. Pin an idea you&apos;re curious
            about to protect it from the ranking.
          </Step>
          <Step n={3} title="Practice">
            <strong>Beat</strong>: a two-to-five-minute aside inside your work, offered when you ask why or when a
            piece of work wraps up. <strong>Studio</strong>: protected time on one idea, working on your own past
            exchange. Studio starts on schedule (the calendar block) or when you kick off something long-running and
            would otherwise be waiting. Claude does it and narrates, then asks first, then steps back, at a pace you
            set.
          </Step>
          <Step n={4} title="Recognize">
            When your own wording shows an idea in use, Helm quotes it back as evidence and asks if that was really
            you. Confirmations, spread over time, move an idea to <em>durable</em>. Saying <em>no</em> is useful too:
            each reason routes somewhere.
          </Step>
        </ol>

        <p className="mt-5 rounded-md bg-panel-2 px-3 py-2 text-ink-2">
          The rule everywhere: Helm observes and proposes; you judge. Nothing changes without you. This is a prototype:
          two seeded people to explore as, state kept in this browser, Reset in the header to start over.
        </p>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            data-testid="intro-start"
          >
            Start working
          </button>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-ink">
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 leading-relaxed text-ink-2">{children}</p>
      </div>
    </li>
  );
}
