"use client";

/**
 * The integration brain. Everything the UI does goes through this context:
 * it owns the BrowserStore, runs the Claude calls, and folds results into
 * state through the pure pipeline functions. Components render state and
 * call actions; they never call the API directly.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { api } from "./api";
import { applyHarvest, toHarvestResult } from "./pipeline/harvest";
import {
  adjustRung,
  answerBeat as answerBeatFn,
  appendStudioMessage,
  endStudio,
  pickMaterial,
  recordBeat,
  setStudioRung,
  startStudio,
} from "./pipeline/practice";
import {
  applyDormancy,
  applyProposal,
  judgeConcept as judgeConceptFn,
  pinConcept as pinConceptFn,
  setActiveSet as setActiveSetFn,
  toProposal,
  type ConceptJudgment,
} from "./pipeline/prune";
import {
  activeConceptsOf,
  applyRecognizeResult,
  judgeRecognition as judgeRecognitionFn,
  type RecognitionDecision,
} from "./pipeline/recognize";
import {
  addCalendarBlock as addCalendarBlockFn,
  removeCalendarBlock as removeCalendarBlockFn,
  resumeStudio as resumeStudioFn,
} from "./pipeline/calendar";
import {
  addConceptNote as addConceptNoteFn,
  addRelationNote as addRelationNoteFn,
  removeConceptNote as removeConceptNoteFn,
  removeRelationNote as removeRelationNoteFn,
  setRelationInsight,
} from "./pipeline/notes";
import {
  addRelation as addRelationFn,
  removeRelation as removeRelationFn,
  sharedExchanges,
} from "./pipeline/relations";
import {
  dismissNudge as dismissNudgeFn,
  finishLongTask,
  offerStudioForTask,
  resolveNudge,
  startLongTask,
} from "./pipeline/triggers";
import { loadSeed } from "./seeds";
import { BrowserStore } from "./store/browser";
import type {
  Exchange,
  LearnerState,
  PersonaId,
  RelationKind,
  Rung,
  StudioEntry,
} from "./types";
import { id, nowIso } from "./util";

// ---------------------------------------------------------------------------
// Transient UI state (not persisted)
// ---------------------------------------------------------------------------

export type BeatUI = {
  status: "streaming" | "ready" | "answered";
  conceptId: string;
  exchangeId: string;
  content: string;
  beatId?: string;
  error?: string;
};

export type StudioUI = {
  sessionId: string;
  streaming: boolean;
  partial: string;
  entering: boolean;
  error?: string;
};

export type Busy = {
  chat: boolean;
  harvest: number;
  recognize: number;
  prune: boolean;
  summarize: boolean;
  /** Edge keys ("a|b|kind") whose insight is being fetched. */
  edges: string[];
};

export type LearnerActions = {
  switchPersona: (personaId: PersonaId) => void;
  resetPersona: () => void;
  /** Switch to a persona AND restore its seed (the walkthrough starts from here). */
  startFresh: (personaId: PersonaId) => void;
  update: (fn: (s: LearnerState) => LearnerState) => void;

  /** Send a work message. Streams the reply, then harvests and recognizes in the background. */
  sendWork: (text: string) => Promise<string | undefined>;
  /** Kick off simulated long-horizon work through the chat. */
  kickOffLongTask: (label?: string) => Promise<void>;
  finishLongTask: () => void;

  /** Beat: the in-work aside. */
  startBeat: (conceptId: string, exchangeId: string, nudgeId?: string) => Promise<void>;
  answerBeat: (answer: string) => void;
  closeBeat: () => void;

  /** Prune. */
  requestPrune: () => Promise<void>;
  chooseActiveSet: (conceptIds: string[]) => void;
  judgeConcept: (conceptId: string, judgment: ConceptJudgment) => void;
  pinConcept: (conceptId: string, pinned: boolean) => void;

  /** Recognize. */
  judgeRecognition: (recognitionId: string, decision: RecognitionDecision) => void;

  /** Studio. */
  enterStudio: (opts: { conceptId: string; entry: StudioEntry; nudgeId?: string }) => Promise<void>;
  sendStudio: (text: string) => Promise<void>;
  changeRung: (direction: "more-help" | "let-me-try") => Promise<void>;
  leaveStudio: (closingStatement?: string) => void;

  /** Edges the learner draws or removes on the map. */
  addRelation: (from: string, to: string, kind: "related" | "prereq") => void;
  removeRelation: (a: string, b: string, kind: RelationKind) => void;

  /** Scroll the work chat to an exchange and flash it (evidence links, edge cards). */
  revealExchange: (exchangeId: string) => void;

  /** The learner's journal: notes on ideas and edges. */
  addConceptNote: (conceptId: string, text: string) => void;
  removeConceptNote: (conceptId: string, noteId: string) => void;
  addRelationNote: (a: string, b: string, kind: RelationKind, text: string) => void;
  removeRelationNote: (a: string, b: string, kind: RelationKind, noteId: string) => void;
  /** Ask Claude why two ideas meet; cached on the edge. Resolves when stored. */
  explainEdge: (a: string, b: string, kind: RelationKind) => Promise<void>;

  /** Studio on the calendar. */
  addCalendarBlock: (block: { dayOfWeek: number; start: string; durationMin: number; conceptId?: string; note?: string }) => void;
  removeCalendarBlock: (index: number) => void;
  /** Reopen a past Studio session and continue it. */
  resumeStudio: (sessionId: string) => void;

  /** Nudges and layout. */
  dismissNudge: (nudgeId: string) => void;
  toggleGraph: () => void;
  /** Dock as a full-height column beside the map (true) or below it (false). */
  setDockFocused: (focused: boolean) => void;
};

export type LearnerContextValue = {
  state: LearnerState;
  personaId: PersonaId;
  busy: Busy;
  /** Exchanges whose harvest call is in flight. */
  harvestingIds: string[];
  beat: BeatUI | null;
  studio: StudioUI | null;
  /** Exchange currently streaming (assistant text is partial). */
  streamingExchangeId: string | null;
  /** Last reveal request; the nonce changes on every call so repeats re-trigger. */
  reveal: { exchangeId: string; nonce: number } | null;
  actions: LearnerActions;
};

const Ctx = createContext<LearnerContextValue | null>(null);

const PERSONA_KEY = "helm:persona";
const HISTORY_EXCHANGES = 8;

function readPersona(): PersonaId {
  try {
    const v = localStorage.getItem(PERSONA_KEY);
    if (v === "backend" || v === "maritime") return v;
  } catch {
    // ignore
  }
  return "backend";
}

const LONG_TASK_PROMPTS: Record<PersonaId, { label: string; message: string }> = {
  backend: {
    label: "Backfill across all shards",
    message:
      "Go ahead and run the shipment_events backfill across all 12 shards with the batched approach we discussed, " +
      "verify row counts per shard against the source, and report back when it's done. Don't wait on me.",
  },
  maritime: {
    label: "Full summary-judgment draft",
    message:
      "Go ahead and draft the full motion for summary judgment on seaman status with the record cites from the " +
      "deposition summaries, plus a proposed order. Full draft, not an outline. Report back when it's ready.",
  },
};

export function LearnerProvider({ children }: { children: ReactNode }) {
  // This provider is only ever rendered client-side (app/page.tsx loads it
  // with ssr: false), so the store can be built during the first render.
  const [personaId, setPersonaId] = useState<PersonaId>(() => readPersona());
  const [store, setStore] = useState<BrowserStore>(() => new BrowserStore(loadSeed(readPersona())));
  const [busy, setBusy] = useState<Busy>({
    chat: false,
    harvest: 0,
    recognize: 0,
    prune: false,
    summarize: false,
    edges: [],
  });
  const [beat, setBeat] = useState<BeatUI | null>(null);
  // A Studio session that was open when the page last closed resumes as idle.
  const [studio, setStudio] = useState<StudioUI | null>(() => {
    const s = store.getState();
    return s.ui.mode === "studio" && s.ui.activeStudioId
      ? { sessionId: s.ui.activeStudioId, streaming: false, partial: "", entering: false }
      : null;
  });
  const [streamingExchangeId, setStreamingExchangeId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{ exchangeId: string; nonce: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped whenever a Studio session ends so an in-flight reply can't write into it.
  const studioGenRef = useRef(0);

  // Dormancy is the only time-based transition; apply it on load.
  useEffect(() => {
    if (store) store.update((s) => applyDormancy(s));
  }, [store]);

  const subscribe = useCallback((cb: () => void) => store.subscribe(() => cb()), [store]);
  const getSnapshot = useCallback(() => store.getState(), [store]);
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const update = useCallback(
    (fn: (s: LearnerState) => LearnerState) => {
      store.update(fn);
    },
    [store],
  );

  const bump = (key: "harvest" | "recognize", delta: number) =>
    setBusy((b) => ({ ...b, [key]: Math.max(0, b[key] + delta) }));

  // ---- Background steps -----------------------------------------------

  const [harvestingIds, setHarvestingIds] = useState<string[]>([]);

  const runHarvest = useCallback(
    async (exchangeId: string, exchange: { user: string; assistant: string }) => {
      if (!store) return;
      bump("harvest", 1);
      setHarvestingIds((ids) => [...ids, exchangeId]);
      try {
        const out = await api.harvest(store.getState().persona.id, exchange, store.conceptIndex());
        const result = toHarvestResult(out);
        store.update((s) => {
          let next = applyHarvest(s, exchangeId, result);
          if (next.longTask?.exchangeId === exchangeId) next = offerStudioForTask(next, exchangeId);
          return next;
        });
      } catch (err) {
        console.error("harvest failed", err);
      } finally {
        bump("harvest", -1);
        setHarvestingIds((ids) => ids.filter((x) => x !== exchangeId));
      }
    },
    [store],
  );

  const runRecognize = useCallback(
    async (exchangeId: string, message: string) => {
      if (!store) return;
      const s = store.getState();
      const active = activeConceptsOf(s);
      if (active.length === 0) return;
      bump("recognize", 1);
      try {
        const out = await api.recognize(s.persona.id, message, active);
        store.update((cur) => applyRecognizeResult(cur, exchangeId, out).state);
      } catch (err) {
        console.error("recognize failed", err);
      } finally {
        bump("recognize", -1);
      }
    },
    [store],
  );

  // ---- Work chat ---------------------------------------------------------

  const sendWork = useCallback(
    async (text: string, opts?: { longTaskLabel?: string }): Promise<string | undefined> => {
      if (!store || busy.chat) return undefined;
      const trimmed = text.trim();
      if (!trimmed) return undefined;
      const s0 = store.getState();
      const exchangeId = id("ex");
      const exchange: Exchange = {
        id: exchangeId,
        personaId: s0.persona.id,
        ts: nowIso(),
        kind: "work",
        user: trimmed,
        assistant: "",
        longTask: !!opts?.longTaskLabel,
      };
      store.appendExchange(exchange);
      if (opts?.longTaskLabel) {
        store.update((s) => startLongTask(s, exchangeId, opts.longTaskLabel!));
      }
      setBusy((b) => ({ ...b, chat: true }));
      setStreamingExchangeId(exchangeId);

      // Recognize runs on the learner's words alone; it doesn't need the reply.
      void runRecognize(exchangeId, trimmed);

      const history = s0.exchanges
        .filter((e) => e.kind === "work" && e.assistant)
        .slice(-HISTORY_EXCHANGES)
        .flatMap((e) => [
          { role: "user" as const, content: e.user },
          { role: "assistant" as const, content: e.assistant },
        ]);
      const controller = new AbortController();
      abortRef.current = controller;
      let full = "";
      try {
        full = await api.chat(
          s0.persona.id,
          [...history, { role: "user", content: trimmed }],
          (_delta, sofar) => {
            full = sofar;
            store.update((s) => ({
              ...s,
              exchanges: s.exchanges.map((e) => (e.id === exchangeId ? { ...e, assistant: sofar } : e)),
            }));
          },
          controller.signal,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "request failed";
        full = full || `[error: ${msg}]`;
        store.update((s) => ({
          ...s,
          exchanges: s.exchanges.map((e) => (e.id === exchangeId ? { ...e, assistant: full } : e)),
        }));
      } finally {
        setBusy((b) => ({ ...b, chat: false }));
        setStreamingExchangeId(null);
        abortRef.current = null;
      }
      if (full && !full.startsWith("[error")) {
        void runHarvest(exchangeId, { user: trimmed, assistant: full });
      }
      return exchangeId;
    },
    [store, busy.chat, runHarvest, runRecognize],
  );

  const kickOffLongTask = useCallback(
    async (label?: string) => {
      if (!store) return;
      const p = store.getState().persona.id;
      const preset = LONG_TASK_PROMPTS[p];
      await sendWork(preset.message, { longTaskLabel: label ?? preset.label });
    },
    [store, sendWork],
  );

  // ---- Beat ---------------------------------------------------------------

  const startBeat = useCallback(
    async (conceptId: string, exchangeId: string, nudgeId?: string) => {
      if (!store) return;
      const s = store.getState();
      const concept = s.concepts[conceptId];
      const exchange = s.exchanges.find((e) => e.id === exchangeId);
      if (!concept || !exchange) return;
      if (nudgeId) store.update((cur) => resolveNudge(cur, nudgeId));
      setBeat({ status: "streaming", conceptId, exchangeId, content: "" });
      try {
        const content = await api.beat(s.persona.id, concept, exchange, (_d, full) =>
          setBeat((b) => (b ? { ...b, content: full } : b)),
        );
        let beatId: string | undefined;
        store.update((cur) => {
          const r = recordBeat(cur, { conceptId, exchangeId, content });
          beatId = r.beat.id;
          return r.state;
        });
        setBeat((b) => (b ? { ...b, status: "ready", content, beatId } : b));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "beat failed";
        setBeat((b) => (b ? { ...b, status: "ready", error: msg } : b));
      }
    },
    [store],
  );

  const answerBeat = useCallback(
    (answer: string) => {
      if (!store || !beat?.beatId) return;
      store.update((s) => answerBeatFn(s, beat.beatId!, answer));
      setBeat((b) => (b ? { ...b, status: "answered" } : b));
    },
    [store, beat],
  );

  const closeBeat = useCallback(() => setBeat(null), []);

  // ---- Prune ---------------------------------------------------------------

  const requestPrune = useCallback(async () => {
    if (!store || busy.prune) return;
    setBusy((b) => ({ ...b, prune: true }));
    try {
      const s = store.getState();
      const out = await api.prune(s);
      store.update((cur) => applyProposal(cur, toProposal(out, cur)));
    } catch (err) {
      console.error("prune failed", err);
    } finally {
      setBusy((b) => ({ ...b, prune: false }));
    }
  }, [store, busy.prune]);

  const chooseActiveSet = useCallback(
    (conceptIds: string[]) => {
      if (!store) return;
      store.update((s) => {
        const next = setActiveSetFn(s, conceptIds);
        // Accepting a set resolves the proposal nudge.
        const nudge = next.nudges.find((n) => n.kind === "prune-proposal" && !n.dismissed);
        return nudge ? resolveNudge(next, nudge.id) : next;
      });
    },
    [store],
  );

  const judgeConcept = useCallback(
    (conceptId: string, judgment: ConceptJudgment) => update((s) => judgeConceptFn(s, conceptId, judgment)),
    [update],
  );
  const pinConcept = useCallback(
    (conceptId: string, pinned: boolean) => update((s) => pinConceptFn(s, conceptId, pinned)),
    [update],
  );

  // ---- Recognize -------------------------------------------------------

  const judgeRecognition = useCallback(
    (recognitionId: string, decision: RecognitionDecision) =>
      update((s) => judgeRecognitionFn(s, recognitionId, decision)),
    [update],
  );

  // ---- Studio ----------------------------------------------------------------

  const streamStudioTurn = useCallback(
    async (sessionId: string) => {
      if (!store) return;
      const s = store.getState();
      const session = s.studioSessions.find((x) => x.id === sessionId);
      if (!session) return;
      const concept = s.concepts[session.conceptId];
      const material = session.materialExchangeId
        ? s.exchanges.find((e) => e.id === session.materialExchangeId)
        : undefined;
      const gen = studioGenRef.current;
      const live = () => studioGenRef.current === gen;
      setStudio({ sessionId, streaming: true, partial: "", entering: false });
      try {
        const text = await api.studio(
          s.persona.id,
          concept,
          session.rung,
          material ? { user: material.user, assistant: material.assistant, ts: material.ts } : undefined,
          session.messages,
          (_d, full) => {
            if (live()) setStudio((st) => (st ? { ...st, partial: full } : st));
          },
          (session.resumedAt?.length ?? 0) > 0,
        );
        if (!live()) return;
        store.update((cur) => appendStudioMessage(cur, sessionId, { role: "assistant", content: text }));
        setStudio({ sessionId, streaming: false, partial: "", entering: false });
      } catch (err) {
        if (!live()) return;
        const msg = err instanceof Error ? err.message : "studio failed";
        setStudio({ sessionId, streaming: false, partial: "", entering: false, error: msg });
      }
    },
    [store],
  );

  const enterStudio = useCallback(
    async (opts: { conceptId: string; entry: StudioEntry; nudgeId?: string }) => {
      if (!store) return;
      const s = store.getState();
      if (!s.concepts[opts.conceptId]) return;
      if (opts.nudgeId) store.update((cur) => resolveNudge(cur, opts.nudgeId!));

      // The state-save ritual. Skipped when the work is literally running.
      // Studio mode switches on immediately so the "saving where you were"
      // moment is visible while the summary is written.
      let workSummary: string | undefined;
      if (opts.entry !== "opportunistic") {
        setBusy((b) => ({ ...b, summarize: true }));
        setStudio({ sessionId: "", streaming: false, partial: "", entering: true });
        store.update((cur) => ({ ...cur, ui: { ...cur.ui, mode: "studio", activeStudioId: undefined } }));
        try {
          workSummary = (await api.summarize(s.exchanges)).summary;
        } catch (err) {
          console.error("summarize failed", err);
        } finally {
          setBusy((b) => ({ ...b, summarize: false }));
        }
      } else if (s.longTask) {
        workSummary = `${s.longTask.label} is running. Nothing is waiting on you.`;
      }

      let sessionId = "";
      store.update((cur) => {
        const r = startStudio(cur, {
          conceptId: opts.conceptId,
          entry: opts.entry,
          materialExchangeId: pickMaterial(cur, opts.conceptId)?.id,
          workSummary,
        });
        sessionId = r.session.id;
        return r.state;
      });
      await streamStudioTurn(sessionId);
    },
    [store, streamStudioTurn],
  );

  const sendStudio = useCallback(
    async (text: string) => {
      if (!store || !studio || studio.streaming) return;
      const trimmed = text.trim();
      if (!trimmed) return;
      store.update((s) => appendStudioMessage(s, studio.sessionId, { role: "user", content: trimmed }));
      await streamStudioTurn(studio.sessionId);
    },
    [store, studio, streamStudioTurn],
  );

  const changeRung = useCallback(
    async (direction: "more-help" | "let-me-try") => {
      if (!store || !studio || studio.streaming) return;
      const s = store.getState();
      const session = s.studioSessions.find((x) => x.id === studio.sessionId);
      if (!session) return;
      const rung: Rung = adjustRung(session.rung, direction);
      if (rung === session.rung) return;
      const note =
        direction === "more-help"
          ? `[Rung change: more help. Move to ${rung}.]`
          : `[Rung change: let me try. Move to ${rung}.]`;
      store.update((cur) =>
        appendStudioMessage(setStudioRung(cur, studio.sessionId, rung), studio.sessionId, {
          role: "user",
          content: note,
        }),
      );
      await streamStudioTurn(studio.sessionId);
    },
    [store, studio, streamStudioTurn],
  );

  const leaveStudio = useCallback(
    (closingStatement?: string) => {
      if (!store) return;
      studioGenRef.current += 1;
      const sid = studio?.sessionId || store.getState().ui.activeStudioId;
      if (sid) store.update((s) => endStudio(s, sid, closingStatement));
      else store.update((s) => ({ ...s, ui: { ...s.ui, mode: "work", activeStudioId: undefined } }));
      setStudio(null);
    },
    [store, studio],
  );

  // ---- Persona, nudges, layout ------------------------------------------

  const switchPersona = useCallback((p: PersonaId) => {
    try {
      localStorage.setItem(PERSONA_KEY, p);
    } catch {
      // ignore
    }
    abortRef.current?.abort();
    setBeat(null);
    const next = new BrowserStore(loadSeed(p));
    const s = next.getState();
    setStudio(
      s.ui.mode === "studio" && s.ui.activeStudioId
        ? { sessionId: s.ui.activeStudioId, streaming: false, partial: "", entering: false }
        : null,
    );
    setPersonaId(p);
    setStore(next);
  }, []);

  const resetPersona = useCallback(() => {
    BrowserStore.clear(personaId);
    abortRef.current?.abort();
    setBeat(null);
    setStudio(null);
    setStore(new BrowserStore(loadSeed(personaId)));
  }, [personaId]);

  const startFresh = useCallback((p: PersonaId) => {
    try {
      localStorage.setItem(PERSONA_KEY, p);
    } catch {
      // ignore
    }
    BrowserStore.clear(p);
    abortRef.current?.abort();
    setBeat(null);
    setStudio(null);
    setPersonaId(p);
    setStore(new BrowserStore(loadSeed(p)));
  }, []);

  const addRelation = useCallback(
    (from: string, to: string, kind: "related" | "prereq") => update((s) => addRelationFn(s, from, to, kind)),
    [update],
  );
  const removeRelation = useCallback(
    (a: string, b: string, kind: RelationKind) => update((s) => removeRelationFn(s, a, b, kind)),
    [update],
  );
  const revealExchange = useCallback(
    (exchangeId: string) => setReveal((r) => ({ exchangeId, nonce: (r?.nonce ?? 0) + 1 })),
    [],
  );

  // ---- Journal, edge insight, calendar ---------------------------------

  const addConceptNote = useCallback(
    (conceptId: string, text: string) => update((s) => addConceptNoteFn(s, conceptId, text)),
    [update],
  );
  const removeConceptNote = useCallback(
    (conceptId: string, noteId: string) => update((s) => removeConceptNoteFn(s, conceptId, noteId)),
    [update],
  );
  const addRelationNote = useCallback(
    (a: string, b: string, kind: RelationKind, text: string) => update((s) => addRelationNoteFn(s, a, b, kind, text)),
    [update],
  );
  const removeRelationNote = useCallback(
    (a: string, b: string, kind: RelationKind, noteId: string) =>
      update((s) => removeRelationNoteFn(s, a, b, kind, noteId)),
    [update],
  );

  const explainEdge = useCallback(
    async (a: string, b: string, kind: RelationKind) => {
      const key = `${a}|${b}|${kind}`;
      const s = store.getState();
      const ca = s.concepts[a];
      const cb = s.concepts[b];
      if (!ca || !cb) return;
      setBusy((x) => (x.edges.includes(key) ? x : { ...x, edges: [...x.edges, key] }));
      try {
        const shared = kind === "cooccur" ? sharedExchanges(s, a, b) : [];
        const { insight } = await api.edge(s.persona.id, ca, cb, kind, shared);
        if (insight) store.update((cur) => setRelationInsight(cur, a, b, kind, insight));
      } catch (err) {
        console.error("edge insight failed", err);
      } finally {
        setBusy((x) => ({ ...x, edges: x.edges.filter((k) => k !== key) }));
      }
    },
    [store],
  );

  const addCalendarBlock = useCallback(
    (block: { dayOfWeek: number; start: string; durationMin: number; conceptId?: string; note?: string }) =>
      update((s) => addCalendarBlockFn(s, block)),
    [update],
  );
  const removeCalendarBlock = useCallback((index: number) => update((s) => removeCalendarBlockFn(s, index)), [update]);

  const resumeStudio = useCallback(
    (sessionId: string) => {
      const s = store.getState();
      if (!s.studioSessions.some((x) => x.id === sessionId)) return;
      studioGenRef.current += 1;
      store.update((cur) => resumeStudioFn(cur, sessionId));
      setStudio({ sessionId, streaming: false, partial: "", entering: false });
    },
    [store],
  );
  const dismissNudge = useCallback((nudgeId: string) => update((s) => dismissNudgeFn(s, nudgeId)), [update]);
  const toggleGraph = useCallback(
    () => update((s) => ({ ...s, ui: { ...s.ui, graphCollapsed: !s.ui.graphCollapsed } })),
    [update],
  );
  const setDockFocused = useCallback(
    (focused: boolean) => update((s) => ({ ...s, ui: { ...s.ui, dockFocused: focused } })),
    [update],
  );
  const finishTask = useCallback(() => update((s) => finishLongTask(s)), [update]);

  const actions = useMemo<LearnerActions>(
    () => ({
      switchPersona,
      resetPersona,
      startFresh,
      update,
      sendWork: (text) => sendWork(text),
      kickOffLongTask,
      finishLongTask: finishTask,
      startBeat,
      answerBeat,
      closeBeat,
      requestPrune,
      chooseActiveSet,
      judgeConcept,
      pinConcept,
      judgeRecognition,
      enterStudio,
      sendStudio,
      changeRung,
      leaveStudio,
      addRelation,
      removeRelation,
      revealExchange,
      addConceptNote,
      removeConceptNote,
      addRelationNote,
      removeRelationNote,
      explainEdge,
      addCalendarBlock,
      removeCalendarBlock,
      resumeStudio,
      dismissNudge,
      toggleGraph,
      setDockFocused,
    }),
    [
      switchPersona,
      resetPersona,
      startFresh,
      update,
      sendWork,
      kickOffLongTask,
      finishTask,
      startBeat,
      answerBeat,
      closeBeat,
      requestPrune,
      chooseActiveSet,
      judgeConcept,
      pinConcept,
      judgeRecognition,
      enterStudio,
      sendStudio,
      changeRung,
      leaveStudio,
      addRelation,
      removeRelation,
      revealExchange,
      addConceptNote,
      removeConceptNote,
      addRelationNote,
      removeRelationNote,
      explainEdge,
      addCalendarBlock,
      removeCalendarBlock,
      resumeStudio,
      dismissNudge,
      toggleGraph,
      setDockFocused,
    ],
  );

  return (
    <Ctx.Provider
      value={{ state, personaId, busy, harvestingIds, beat, studio, streamingExchangeId, reveal, actions }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useLearner(): LearnerContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLearner must be used inside LearnerProvider");
  return v;
}
