/**
 * Shared class strings and small pure helpers for the learning modes
 * (Beat overlay and Studio view). Tokens only; no hardcoded colors.
 */

import type { Rung, StudioEntry } from "@/lib/types";

export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export const btnPrimary =
  "rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-panel transition-colors " +
  "hover:bg-accent-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-accent " +
  focusRing;

export const btnQuiet =
  "rounded-md border border-rule px-3 py-1.5 text-xs text-ink-2 transition-colors " +
  "hover:bg-panel-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 " +
  "disabled:hover:bg-transparent disabled:hover:text-ink-2 " +
  focusRing;

export const btnLink =
  "rounded text-xs text-ink-2 underline-offset-2 hover:text-ink hover:underline " + focusRing;

export const field =
  "w-full rounded-md border border-rule bg-panel px-3 py-2 text-sm text-ink placeholder:text-ink-2 " +
  "focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

// ---- Rungs ------------------------------------------------------------------

export const RUNGS: { id: Rung; meaning: string }[] = [
  { id: "modeling", meaning: "Claude does it and narrates" },
  { id: "coaching", meaning: "you do it, Claude asks first" },
  { id: "fading", meaning: "you work, Claude's available" },
];

export function rungMeaning(rung: Rung): string {
  return RUNGS.find((r) => r.id === rung)?.meaning ?? "";
}

export const COMPOSER_PLACEHOLDER: Record<Rung, string> = {
  modeling: "Predict the next step, or ask about this one",
  coaching: "Your attempt, or ask for a hint",
  fading: "Work here; ask when you want to",
};

// ---- Studio entry -----------------------------------------------------------

export const ENTRY_LABEL: Record<StudioEntry, string> = {
  scheduled: "scheduled",
  opportunistic: "while your task runs",
  manual: "",
};

export const ENTRY_TITLE: Record<StudioEntry, string> = {
  scheduled: "Started from your calendar block",
  opportunistic: "Started while your long task runs; nothing is waiting on you",
  manual: "Started from the map",
};

// ---- Explanations (rendered through components/ui/Hint) --------------------

export const HINTS = {
  beat:
    "A two-to-five-minute aside inside your work. Claude explains the why behind what it just did, " +
    "using this exchange, and ends with one question you can answer in a sentence. Leaving is one click at any point.",
  beatAnswer:
    "Your one-sentence answer is kept with the idea. It isn't graded; it's the start of you steering this kind of work.",
  studio:
    "Protected time on one idea, working on your own past exchange. Your work is saved (the \u201cWhere you were\u201d card) " +
    "so it's safe to leave it. Close with one sentence about what you'd now specify differently; " +
    "that sentence is what Helm later recognizes.",
  rungs:
    "Modeling: Claude does it and narrates, you predict. Coaching: you do it, Claude asks before it tells. " +
    "Fading: you work, Claude is available. More help drops a rung; Let me try raises one.",
  whereYouWere: "Written when you stepped out of your work, so you can come back to it.",
};

/**
 * The Beat card sits at the bottom of the main region, so its hints open
 * upward. Targets the shared Hint's tooltip by role, from its wrapper.
 */
export const hintOpensUp =
  "[&>[role=tooltip]]:top-auto [&>[role=tooltip]]:bottom-full [&>[role=tooltip]]:mt-0 [&>[role=tooltip]]:mb-1";

// ---- Thread helpers -----------------------------------------------------------

const RUNG_NOTE = /^\[Rung change: (more help|let me try)\. Move to (modeling|coaching|fading)\.\]$/i;

export function isRungNote(content: string): boolean {
  return content.trimStart().startsWith("[Rung change");
}

/** "[Rung change: more help. Move to modeling.]" → a short system line. */
export function describeRungNote(content: string): string {
  const m = content.trim().match(RUNG_NOTE);
  if (!m) return content.trim().replace(/^\[/, "").replace(/\]$/, "");
  const rung = m[2].toLowerCase();
  return m[1].toLowerCase() === "more help"
    ? `You asked for more help. Now ${rung}.`
    : `You chose to try it yourself. Now ${rung}.`;
}

/** Summarize output is three plain lines; drop any list markers the model adds. */
export function summaryLines(summary: string): string[] {
  return summary
    .split("\n")
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s+/, "").trim())
    .filter(Boolean);
}

export const SUMMARY_LABELS = ["Working on", "Where it stands", "Next"];

/**
 * If Claude has already asked the closing question in the thread and the
 * learner answered it there, reuse that answer so they aren't asked twice.
 */
export function guessClosingSentence(messages: { role: "user" | "assistant"; content: string }[]): string {
  for (let i = messages.length - 1; i > 0; i--) {
    const m = messages[i];
    const prev = messages[i - 1];
    if (
      m.role === "user" &&
      !isRungNote(m.content) &&
      prev.role === "assistant" &&
      /specify/i.test(prev.content) &&
      /differently/i.test(prev.content)
    ) {
      return m.content.replace(/\s+/g, " ").trim();
    }
  }
  return "";
}
