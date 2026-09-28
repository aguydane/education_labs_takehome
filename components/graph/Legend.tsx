import { STATE_BLURB, STATE_LABEL, STATE_ORDER, stateVar } from "./shared";

/** What the colors and marks on the map mean. */
export default function Legend() {
  return (
    <div data-testid="graph-legend" className="@container shrink-0 border-t border-rule px-4 py-1.5 text-xs leading-5 text-ink-2">
      <ul className="flex flex-wrap gap-x-4">
        {STATE_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-1.5" title={`${STATE_LABEL[s]}: ${STATE_BLURB[s]}`}>
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-rule"
              style={{ background: stateVar(s) }}
            />
            <span className="text-ink">{STATE_LABEL[s]}</span>
            {/* The five-word explanations show when the panel has room; the title carries them otherwise. */}
            <span className="hidden @min-[34rem]:inline">{STATE_BLURB[s]}</span>
          </li>
        ))}
      </ul>
      <p>Ring: active · dashed ring: recommended · dot: pinned · hover for names</p>
    </div>
  );
}
