"use client";

import { PERSONAS, PERSONA_IDS } from "@/lib/personas";
import { useLearner } from "@/lib/learner-context";

export default function Header({ onHelp }: { onHelp?: () => void }) {
  const { state, personaId, busy, actions } = useLearner();
  const working = busy.harvest > 0 || busy.recognize > 0;

  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-rule bg-panel px-4">
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold tracking-tight">Helm</span>
        <span className="hidden text-xs text-ink-2 sm:inline">
          Claude does the work. You keep the understanding.
        </span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span
          className={`flex items-center gap-1.5 text-xs text-ink-2 transition-opacity ${working ? "opacity-100" : "opacity-0"}`}
          title="Harvest and recognize run quietly after each exchange"
          data-testid="background-indicator"
        >
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
          harvesting
        </span>

        <div className="flex rounded-md border border-rule p-0.5" role="tablist" aria-label="Persona">
          {PERSONA_IDS.map((pid) => {
            const p = PERSONAS[pid];
            const selected = pid === personaId;
            return (
              <button
                key={pid}
                role="tab"
                aria-selected={selected}
                onClick={() => actions.switchPersona(pid)}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  selected ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:text-ink"
                }`}
                data-testid={`persona-${pid}`}
              >
                {p.name.split(" ")[0]}
                <span className="hidden md:inline"> · {pid === "backend" ? "backend" : "maritime law"}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={onHelp}
          className="text-xs text-ink-2 hover:text-ink"
          title="What Helm does and what the parts mean"
          data-testid="header-how"
        >
          How Helm works
        </button>

        <button
          onClick={() => {
            if (window.confirm(`Reset ${state.persona.name}'s history to the seed?`)) actions.resetPersona();
          }}
          className="text-xs text-ink-2 hover:text-ink"
          title="Restore this persona's seed state"
          data-testid="reset-persona"
        >
          Reset
        </button>
      </div>
    </header>
  );
}
