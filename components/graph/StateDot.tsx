import type { ConceptState } from "@/lib/types";
import { HOLLOW, STATE_OPACITY, stateVar } from "./shared";

/**
 * A small swatch drawn exactly like a node on the map: hollow ring or filled
 * disc in the state color, faded for delegated and dormant, with the strike
 * mark for delegated. Used by the legend, chips, and lists so they match.
 */
export default function StateDot({ state, size = 10, className = "" }: { state: ConceptState; size?: number; className?: string }) {
  const hollow = HOLLOW[state];
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className={`inline-block shrink-0 ${className}`}
      style={{ opacity: STATE_OPACITY[state] }}
    >
      <circle
        cx={6}
        cy={6}
        r={hollow ? 4.6 : 5.2}
        fill={hollow ? "var(--panel)" : stateVar(state)}
        stroke={hollow ? stateVar(state) : "none"}
        strokeWidth={hollow ? 1.8 : 0}
      />
      {state === "delegated" ? (
        <line x1={3.2} y1={8.8} x2={8.8} y2={3.2} stroke="var(--ink)" strokeWidth={1.3} strokeLinecap="round" />
      ) : null}
    </svg>
  );
}
