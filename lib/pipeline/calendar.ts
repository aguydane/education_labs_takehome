import type { CalendarBlock, LearnerState, StudioSession } from "@/lib/types";
import { id, nowIso } from "@/lib/util";

/**
 * Studio time on the calendar: upcoming blocks with real dates, and the
 * history of sessions the learner can reopen.
 */

export type UpcomingBlock = {
  index: number;
  block: CalendarBlock;
  /** The next occurrence, as an ISO timestamp. */
  at: string;
  conceptName?: string;
};

function nextOccurrence(block: CalendarBlock, now: Date): Date {
  const [h, m] = block.start.split(":").map((x) => parseInt(x, 10));
  const d = new Date(now);
  d.setHours(h || 0, m || 0, 0, 0);
  let delta = (block.dayOfWeek - d.getDay() + 7) % 7;
  if (delta === 0 && d.getTime() + block.durationMin * 60_000 < now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d;
}

/** Blocks in order of their next occurrence. */
export function upcomingBlocks(state: LearnerState, now = new Date()): UpcomingBlock[] {
  return state.calendar
    .map((block, index) => ({
      index,
      block,
      at: nextOccurrence(block, now).toISOString(),
      conceptName: block.conceptId ? state.concepts[block.conceptId]?.name : undefined,
    }))
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function addCalendarBlock(
  state: LearnerState,
  block: Omit<CalendarBlock, "id">,
): LearnerState {
  return { ...state, calendar: [...state.calendar, { ...block, id: id("block") }] };
}

export function removeCalendarBlock(state: LearnerState, index: number): LearnerState {
  return { ...state, calendar: state.calendar.filter((_, i) => i !== index) };
}

/** Sessions newest first. */
export function studioHistory(state: LearnerState): StudioSession[] {
  return [...state.studioSessions].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

/**
 * Reopen a past session to dig in further. The thread continues where it
 * left off; the closing statement, if any, stays on record.
 */
export function resumeStudio(state: LearnerState, sessionId: string, now = nowIso()): LearnerState {
  const session = state.studioSessions.find((s) => s.id === sessionId);
  if (!session) return state;
  return {
    ...state,
    studioSessions: state.studioSessions.map((s) =>
      s.id === sessionId ? { ...s, endedAt: undefined, resumedAt: [...(s.resumedAt ?? []), now] } : s,
    ),
    ui: { ...state.ui, mode: "studio", activeStudioId: sessionId },
  };
}
