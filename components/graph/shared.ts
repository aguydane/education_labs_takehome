/**
 * Small helpers shared by the graph panel's pieces: state vocabulary,
 * formatting, and the button styles the panel reuses.
 */

import { deriveGraph, type Graph } from "@/lib/pipeline/graph";
import { PERSONAS } from "@/lib/personas";
import { createInitialState } from "@/lib/state";
import type { CalendarBlock, Concept, ConceptState, LearnerState } from "@/lib/types";

export const STATE_ORDER: ConceptState[] = ["noticed", "chosen", "practicing", "durable", "delegated", "dormant"];

export const STATE_LABEL: Record<ConceptState, string> = {
  noticed: "Noticed",
  chosen: "Chosen",
  practicing: "Practicing",
  durable: "Durable",
  delegated: "Delegated",
  dormant: "Dormant",
};

/** Five words each: the legend under the map. */
export const STATE_BLURB: Record<ConceptState, string> = {
  noticed: "came up in your work",
  chosen: "you picked it to practice",
  practicing: "practiced; evidence is building up",
  durable: "shows up in your steering",
  delegated: "Claude handles it, by choice",
  dormant: "hasn't come up in weeks",
};

export function stateVar(s: ConceptState): string {
  return `var(--st-${s})`;
}

const STOP = new Set(["a", "an", "and", "of", "the", "for", "to", "in", "on", "vs", "v", "with", "or"]);

/** "Query planning and indexes" → "QPI"; "Idempotency" → "Id". */
export function abbreviate(name: string): string {
  const words = name.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const significant = words.filter((w) => !STOP.has(w.toLowerCase()));
  const use = significant.length ? significant : words;
  if (use.length === 0) return "?";
  if (use.length === 1) {
    const w = use[0];
    return w.charAt(0).toUpperCase() + w.slice(1, 2).toLowerCase();
  }
  return use
    .slice(0, 3)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

export function truncate(s: string, n = 18): string {
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
}

export function confirmedCount(c: Concept): number {
  return c.recognitions.filter((r) => r.status === "confirmed").length;
}

// ---- Time -----------------------------------------------------------------

export const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function parseHM(start: string): number {
  const [h, m] = start.split(":").map((x) => Number.parseInt(x, 10));
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function fmtMinutes(total: number, compact: boolean, withSuffix = true): string {
  const t = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(t / 60);
  const m = t % 60;
  const suffix = withSuffix ? (h >= 12 ? "p" : "a") : "";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (compact && m === 0) return `${h12}${suffix}`;
  return `${h12}:${String(m).padStart(2, "0")}${suffix}`;
}

/** "Thu 2p" */
export function blockShort(b: CalendarBlock): string {
  return `${DAY_SHORT[b.dayOfWeek] ?? ""} ${fmtMinutes(parseHM(b.start), true)}`.trim();
}

/** "2:00–2:30p" (the suffix is shared when both ends fall on the same side of noon). */
export function blockRange(b: CalendarBlock): string {
  const start = parseHM(b.start);
  const end = start + b.durationMin;
  const samePeriod = (start < 720) === (end % 1440 < 720);
  return `${fmtMinutes(start, false, !samePeriod)}–${fmtMinutes(end, false)}`;
}

export function fmtDate(ts: string): string {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return "";
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ago(ts: string, now: number): string {
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (now - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86_400)}d ago`;
}

// ---- Graph ---------------------------------------------------------------

// deriveGraph reads only concepts and activeSet. Building it from those two
// (instead of the whole state) lets the canvas skip re-rendering while chat
// tokens stream into state.exchanges.
const SHELL: LearnerState = createInitialState(PERSONAS.backend);

export function graphFor(
  concepts: LearnerState["concepts"],
  activeSet: LearnerState["activeSet"],
  minute: number,
): Graph {
  return deriveGraph({ ...SHELL, concepts, activeSet }, new Date(minute * 60_000).toISOString());
}

// ---- Styles ----------------------------------------------------------------

export const BTN =
  "inline-flex items-center gap-1.5 rounded-md border border-rule px-2.5 py-1 text-xs text-ink transition-colors hover:bg-panel-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent";
export const BTN_ON = "border-accent bg-accent-soft text-accent-ink hover:bg-accent-soft";
export const BTN_PRIMARY =
  "inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-panel transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45";
export const ICON_BTN =
  "flex h-8 w-8 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink";
