import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-only. Reads ANTHROPIC_API_KEY from the environment.
 * Never import from a client component.
 */
export const client = new Anthropic();

export const MODELS = {
  /** Everything the learner reads: chat, Beat, Studio, Prune. */
  learner: "claude-opus-5-5",
  /** Background extractors that run on every exchange: harvest, recognize, summarize. */
  background: "claude-sonnet-5",
} as const;

/** Opus 5.5 always thinks; effort is the only depth control and defaults to medium. Set it everywhere. */
export type Effort = "low" | "medium" | "high";
