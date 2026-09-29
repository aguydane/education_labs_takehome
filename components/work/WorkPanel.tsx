"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLearner } from "@/lib/learner-context";
import { pendingNudges } from "@/lib/pipeline/triggers";
import type { Exchange, Nudge } from "@/lib/types";
import Composer from "./Composer";
import ExchangeItem, { type RecognitionEntry } from "./ExchangeItem";
import { FLASH_MS, dayKey, dayLabel, useNow } from "./helpers";
import LongTaskStrip from "./LongTaskStrip";

const NO_RECOGNITIONS: RecognitionEntry[] = [];
const NO_OFFERS: Nudge[] = [];
/** Within this many px of the bottom counts as "following along". */
const STICK_PX = 96;

export default function WorkPanel() {
  const { state, busy, harvestingIds, streamingExchangeId, reveal, actions } = useLearner();
  const now = useNow(60_000);

  const work = useMemo(
    () =>
      state.exchanges
        .filter((e) => e.kind === "work")
        .map((e, i) => ({ e, i, t: Date.parse(e.ts) || 0 }))
        .sort((a, b) => a.t - b.t || a.i - b.i)
        .map(({ e }) => e),
    [state.exchanges],
  );

  const groups = useMemo(() => {
    const out: { key: string; ts: string; items: Exchange[] }[] = [];
    for (const e of work) {
      const key = dayKey(e.ts);
      const last = out[out.length - 1];
      if (last && last.key === key) last.items.push(e);
      else out.push({ key, ts: e.ts, items: [e] });
    }
    return out;
  }, [work]);

  // Recognitions render under the learner message that earned them.
  const recognitionsByExchange = useMemo(() => {
    const m = new Map<string, RecognitionEntry[]>();
    for (const concept of Object.values(state.concepts)) {
      for (const recognition of concept.recognitions) {
        if (recognition.status === "rejected") continue;
        const list = m.get(recognition.exchangeId) ?? [];
        list.push({ recognition, concept });
        m.set(recognition.exchangeId, list);
      }
    }
    for (const list of m.values()) list.sort((a, b) => a.recognition.ts.localeCompare(b.recognition.ts));
    return m;
  }, [state.concepts]);

  // Beat and Studio offers anchored to an exchange render under it.
  const offersByExchange = new Map<string, Nudge[]>();
  for (const n of pendingNudges(state)) {
    if (n.kind !== "beat-offer" && n.kind !== "studio-offer") continue;
    if (!n.exchangeId || !n.conceptId) continue;
    const list = offersByExchange.get(n.exchangeId) ?? [];
    list.push(n);
    offersByExchange.set(n.exchangeId, list);
  }

  // ---- Scrolling: follow the bottom unless the learner has scrolled up ----
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  const toBottom = useCallback(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
  };

  // Growth (streaming text, chips arriving, cards) keeps the view pinned when following.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) toBottom();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [toBottom]);

  // A new exchange (or a persona switch) always jumps to the bottom.
  const lastId = work.length ? work[work.length - 1].id : null;
  const streamingLen = streamingExchangeId
    ? (work.find((e) => e.id === streamingExchangeId)?.assistant.length ?? 0)
    : 0;
  useEffect(() => {
    stickRef.current = true;
    toBottom();
  }, [lastId, toBottom]);
  useEffect(() => {
    if (stickRef.current) toBottom();
  }, [streamingLen, toBottom]);

  // ---- Reveal: scroll an exchange into view and flash the learner's message ----
  // A reveal that predates this mount (e.g. from before a Studio session) is already settled.
  const [settledNonce, setSettledNonce] = useState<number | null>(() => reveal?.nonce ?? null);
  const flashing = reveal && reveal.nonce !== settledNonce ? reveal : null;

  useEffect(() => {
    if (!reveal || reveal.nonce === settledNonce) return;
    const container = scrollRef.current;
    const target = container?.querySelector<HTMLElement>(
      `[data-testid="exchange-${CSS.escape(reveal.exchangeId)}"]`,
    );
    if (container && target) {
      stickRef.current = false;
      const top =
        target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      container.scrollTo({ top: Math.max(0, top), behavior: reduce ? "auto" : "smooth" });
    }
    const t = window.setTimeout(() => setSettledNonce(reveal.nonce), FLASH_MS);
    return () => window.clearTimeout(t);
  }, [reveal, settledNonce]);

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid="work-panel">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto" data-testid="work-messages">
        <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6">
          {work.length === 0 ? (
            <p className="py-24 text-center text-sm text-ink-2" data-testid="work-empty">
              Start with whatever you&apos;re working on; Helm will quietly note the ideas underneath it as you go.
            </p>
          ) : (
            groups.map((g) => (
              <Fragment key={g.key}>
                <DayDivider ts={g.ts} now={now} />
                {g.items.map((e) => (
                  <ExchangeItem
                    key={e.id}
                    exchange={e}
                    concepts={state.concepts}
                    recognitions={recognitionsByExchange.get(e.id) ?? NO_RECOGNITIONS}
                    offers={offersByExchange.get(e.id) ?? NO_OFFERS}
                    streaming={e.id === streamingExchangeId}
                    harvesting={harvestingIds.includes(e.id)}
                    flashKey={flashing?.exchangeId === e.id ? flashing.nonce : null}
                    actions={actions}
                  />
                ))}
              </Fragment>
            ))
          )}
        </div>
      </div>

      {state.longTask ? (
        <LongTaskStrip
          key={`${state.longTask.exchangeId}:${state.longTask.startedAt}`}
          task={state.longTask}
          onDone={actions.finishLongTask}
        />
      ) : null}

      <Composer
        busy={busy.chat}
        longTaskRunning={!!state.longTask}
        onSend={(text) => void actions.sendWork(text)}
        onKickOff={() => void actions.kickOffLongTask()}
      />
    </div>
  );
}

function DayDivider({ ts, now }: { ts: string; now: number }) {
  const { primary, secondary } = dayLabel(ts, now);
  return (
    <div className="flex items-center gap-3 text-xs text-ink-2" role="separator" aria-label={primary}>
      <span className="h-px flex-1 bg-rule" />
      <span>
        {primary}
        {secondary ? <span className="opacity-70"> · {secondary}</span> : null}
      </span>
      <span className="h-px flex-1 bg-rule" />
    </div>
  );
}
