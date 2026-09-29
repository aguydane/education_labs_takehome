/** In-place explanations for the graph panel, shown through the shared Hint. */
export const HINTS = {
  map: "Every idea your work has surfaced, one node each. Size is how much it's been coming up lately; colour and shape are its state. Click a node for details, drag to arrange, click a line to see why two ideas are joined.",
  budget:
    "The share of your week you decided to set aside. Not tracked, not measured; just a reminder that this time is yours.",
  studio:
    "Studio is protected time on one idea. Your calendar shows the block and your colleagues see Busy, so leaving your work is safe. The button simulates the time arriving.",
  activeSet:
    "The two or three ideas you're practicing now. Helm proposes; you decide. It stays put for weeks on purpose: slots turn over when an idea becomes durable or you drop it.",
  prune: "Ask Claude to propose an active set, with its reasoning. Nothing changes until you accept.",
  proposal: "Claude's reasoning for each idea, in plain words. Untick to disagree; pinned ideas stay.",
  confidence:
    "Helm's estimate of how well you have this, from your own wording only. 'I know this' and 'I don't' overrule it.",
  delegate: "Never suggest practicing this. It stays on the map, dimmed, and can be brought back.",
  connections:
    "Lines from your work join ideas that came up in the same exchange. You can add your own: related, or one that needs another first.",
  inbox: "Offers Helm has raised: a beat, studio time, or an idea that's gone quiet. Nothing here interrupts you; it waits.",
} as const;

/** For a Hint near the right edge of the panel: open its tooltip leftward so it isn't clipped. */
export const HINT_OPENS_LEFT = "[&>[role=tooltip]]:left-auto [&>[role=tooltip]]:right-0";
