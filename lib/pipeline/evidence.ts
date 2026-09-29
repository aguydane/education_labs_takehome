/**
 * Harvest is only allowed to judge the learner by the learner's own words.
 * The model is told this, and this file checks it mechanically: a quote
 * that can't be found in the learner's message is not evidence.
 */

export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*_>#]/g, "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** True when `quote` appears in `text` verbatim, or nearly so (light paraphrase). */
export function quoteIsFrom(text: string, quote: string): boolean {
  const t = normalizeForMatch(text);
  const q = normalizeForMatch(quote);
  if (q.length < 8) return false;
  if (t.includes(q)) return true;
  const words = q.split(" ").filter(Boolean);
  if (words.length < 5) return false;
  const shingles: string[] = [];
  for (let i = 0; i + 3 <= words.length; i++) shingles.push(words.slice(i, i + 3).join(" "));
  const hits = shingles.filter((s) => t.includes(s)).length;
  return hits / shingles.length >= 0.6;
}

export type EvidenceVerdict = "learner" | "assistant" | "unknown";

/** Which side of the exchange a quote came from. */
export function evidenceVerdict(user: string, assistant: string, quote: string): EvidenceVerdict {
  if (!quote.trim()) return "unknown";
  if (quoteIsFrom(user, quote)) return "learner";
  if (quoteIsFrom(assistant, quote)) return "assistant";
  return "unknown";
}
