import { useEffect, useState } from "react";
import type { Concept, ConceptState, Confidence, HarvestedConcept } from "@/lib/types";
import { slug } from "@/lib/util";

/** Shared visible focus treatment for every control in the work panel. */
export const FOCUS =
  "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

const BTN_BASE = `rounded-md border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

/** Plain secondary button. */
export const BTN_QUIET = `${BTN_BASE} border-rule text-ink hover:bg-panel-2`;

/** Secondary button that leads somewhere (Beat, confirm). */
export const BTN_QUIET_ACCENT = `${BTN_BASE} border-accent/50 text-accent-ink hover:bg-accent-soft`;

export const BTN_ACCENT = `rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-panel transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${FOCUS}`;

export const CONFIDENCE_DOT: Record<Confidence, string> = {
  unknown: "bg-st-noticed",
  low: "bg-warn",
  medium: "bg-accent",
  high: "bg-ok",
};

export const STATE_DOT: Record<ConceptState, string> = {
  noticed: "bg-st-noticed",
  chosen: "bg-st-chosen",
  practicing: "bg-st-practicing",
  durable: "bg-st-durable",
  delegated: "bg-st-delegated",
  dormant: "bg-st-dormant",
};

export const STATE_LABEL: Record<ConceptState, string> = {
  noticed: "Noticed",
  chosen: "Chosen",
  practicing: "Practicing",
  durable: "Durable",
  delegated: "Delegated",
  dormant: "Dormant",
};

/**
 * Map a harvested concept to the learner model: the matched id if it still
 * exists, else a case-insensitive name match, else the slug harvest would
 * have used when it created the concept.
 */
export function resolveConcept(
  hc: HarvestedConcept,
  concepts: Record<string, Concept>,
): Concept | undefined {
  if (hc.matchesExistingId && concepts[hc.matchesExistingId]) return concepts[hc.matchesExistingId];
  const name = hc.name.trim().toLowerCase();
  return Object.values(concepts).find((c) => c.name.trim().toLowerCase() === name) ?? concepts[slug(hc.name)];
}

/** A clock that re-renders every `intervalMs`. */
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

// ---- Day dividers -----------------------------------------------------------

const DAY_MS = 86_400_000;

function startOfDay(t: number): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function dayKey(ts: string): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function formatDate(t: number, now: number): string {
  const d = new Date(t);
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** "Today", "Yesterday", "Tue, Sep 16", or "3 weeks ago" with the date as a secondary label. */
export function dayLabel(ts: string, now: number): { primary: string; secondary?: string } {
  const t = Date.parse(ts);
  if (!Number.isFinite(t)) return { primary: "Earlier" };
  const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY_MS);
  const date = formatDate(t, now);
  if (days <= 0) return { primary: "Today" };
  if (days === 1) return { primary: "Yesterday", secondary: date };
  if (days < 7) return { primary: date };
  const weeks = Math.floor(days / 7);
  return { primary: weeks === 1 ? "1 week ago" : `${weeks} weeks ago`, secondary: date };
}
