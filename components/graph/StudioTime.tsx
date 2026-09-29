"use client";

import { useState } from "react";
import { useLearner } from "@/lib/learner-context";
import { studioHistory, upcomingBlocks } from "@/lib/pipeline/calendar";
import { CloseIcon } from "./icons";
import { BTN, BTN_PRIMARY, DAY_LONG, ENTRY_WORDS, blockRange, fmtDate } from "./shared";

const FIELD = "rounded-md border border-rule bg-panel px-2 py-1 text-xs text-ink focus:border-accent focus:outline-none";
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

/** The next weekday after `now` (Friday or the weekend rolls to Monday). */
function nextWorkday(now: number): number {
  const d = (new Date(now).getDay() + 1) % 7;
  return d === 0 || d === 6 ? 1 : d;
}

/**
 * Studio time beyond this week's strip: what's coming up, a form to book more,
 * and every past session, each of which opens in the dock.
 */
export default function StudioTime({
  now,
  selectedSessionId,
  onSelectSession,
}: {
  now: number;
  selectedSessionId: string | null;
  onSelectSession: (id: string) => void;
}) {
  const { state, actions } = useLearner();
  const [adding, setAdding] = useState(false);
  const upcoming = upcomingBlocks(state, new Date(now));
  const history = studioHistory(state);

  return (
    <div className="mt-2 space-y-3 border-t border-rule pt-2" data-testid="studio-time">
      <section>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-medium text-ink-2">Upcoming</h4>
          <button
            type="button"
            data-testid="calendar-add"
            className={BTN}
            aria-expanded={adding}
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? "Cancel" : "Schedule studio time"}
          </button>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-1 text-xs text-ink-2">No studio time scheduled.</p>
        ) : (
          <ul className="mt-1 space-y-1">
            {upcoming.map((u) => (
              <li key={u.block.id ?? `${u.index}-${u.block.dayOfWeek}-${u.block.start}`} className="flex items-start gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="text-ink">
                    <span className="tabular-nums">
                      {dateLabel(u.at)} · {blockRange(u.block)}
                    </span>{" "}
                    · {u.conceptName ?? "open practice"}
                  </p>
                  {u.block.note ? <p className="text-ink-2">{u.block.note}</p> : null}
                </div>
                <button
                  type="button"
                  data-testid={`calendar-remove-${u.index}`}
                  onClick={() => actions.removeCalendarBlock(u.index)}
                  aria-label={`Remove the ${DAY_LONG[u.block.dayOfWeek]} ${blockRange(u.block)} block`}
                  title="Remove this block"
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-2 hover:bg-panel-2 hover:text-ink"
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {adding ? <ScheduleForm now={now} onDone={() => setAdding(false)} /> : null}
      </section>

      <section>
        <h4 className="text-xs font-medium text-ink-2">History · {history.length}</h4>
        {history.length === 0 ? (
          <p className="mt-1 text-xs text-ink-2">No studio sessions yet.</p>
        ) : (
          <ul className="mt-1 max-h-56 space-y-0.5 overflow-y-auto">
            {history.map((s) => {
              const name = state.concepts[s.conceptId]?.name ?? "an idea no longer on the map";
              const resumed = s.resumedAt?.length ?? 0;
              const selected = s.id === selectedSessionId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    data-testid={`history-${s.id}`}
                    aria-pressed={selected}
                    onClick={() => onSelectSession(s.id)}
                    className={`w-full rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      selected ? "bg-accent-soft" : "hover:bg-panel-2"
                    }`}
                  >
                    <span className="block text-ink-2">
                      <span className="tabular-nums">{fmtDate(s.startedAt)}</span> ·{" "}
                      <span className="font-medium text-ink">{name}</span> · {ENTRY_WORDS[s.entry]} · {s.rung}
                      {resumed > 0 ? ` · resumed ×${resumed}` : ""}
                      {!s.endedAt ? " · open" : ""}
                    </span>
                    <span className={`mt-0.5 block line-clamp-2 ${s.closingStatement ? "text-ink" : "text-ink-2"}`}>
                      {s.closingStatement ? `“${s.closingStatement}”` : "no closing statement"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ScheduleForm({ now, onDone }: { now: number; onDone: () => void }) {
  const { state, actions } = useLearner();
  const eligible = Object.values(state.concepts)
    .filter((c) => c.state !== "dormant" && c.state !== "delegated")
    .sort((a, b) => a.name.localeCompare(b.name));
  const firstActive = state.activeSet.conceptIds.find((cid) => eligible.some((c) => c.id === cid));

  const [conceptId, setConceptId] = useState(() => firstActive ?? eligible[0]?.id ?? "");
  const [day, setDay] = useState(() => nextWorkday(now));
  const [time, setTime] = useState("14:00");
  const [duration, setDuration] = useState(30);
  const [note, setNote] = useState("");

  const submit = () => {
    if (!/^\d{1,2}:\d{2}$/.test(time)) return;
    actions.addCalendarBlock({
      dayOfWeek: day,
      start: time,
      durationMin: duration,
      conceptId: conceptId || undefined,
      note: note.trim() || undefined,
    });
    onDone();
  };

  return (
    <div data-testid="calendar-add-form" className="mt-2 space-y-1.5 rounded-md border border-rule p-2.5">
      <label className="block text-xs text-ink-2">
        Idea
        <select
          data-testid="calendar-add-concept"
          value={conceptId}
          onChange={(e) => setConceptId(e.target.value)}
          className={`mt-0.5 block w-full ${FIELD}`}
        >
          {eligible.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap items-end gap-1.5">
        <label className="text-xs text-ink-2">
          Day
          <select
            data-testid="calendar-add-day"
            value={day}
            onChange={(e) => setDay(Number(e.target.value))}
            className={`mt-0.5 block ${FIELD}`}
          >
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAY_LONG[d]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-ink-2">
          Start
          <input
            type="time"
            data-testid="calendar-add-time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={`mt-0.5 block ${FIELD}`}
          />
        </label>
        <label className="text-xs text-ink-2">
          Length
          <select
            data-testid="calendar-add-duration"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className={`mt-0.5 block ${FIELD}`}
          >
            {[30, 45, 60].map((m) => (
              <option key={m} value={m}>
                {m} min
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs text-ink-2">
        What you want out of it <span className="text-ink-2">(optional)</span>
        <input
          type="text"
          data-testid="calendar-add-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          className={`mt-0.5 block w-full ${FIELD}`}
        />
      </label>
      <div className="flex justify-end">
        <button type="button" data-testid="calendar-add-submit" className={BTN_PRIMARY} onClick={submit}>
          Add
        </button>
      </div>
    </div>
  );
}
