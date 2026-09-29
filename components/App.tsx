"use client";

import { useEffect } from "react";
import Header from "@/components/Header";
import Tour from "@/components/Tour";
import GraphPanel from "@/components/graph/GraphPanel";
import BeatOverlay from "@/components/modes/BeatOverlay";
import StudioView from "@/components/modes/StudioView";
import WorkPanel from "@/components/work/WorkPanel";
import { LearnerProvider, useLearner } from "@/lib/learner-context";
import { shouldAutoOpen, tourStore } from "@/lib/tour-store";

export default function App() {
  return (
    <LearnerProvider>
      <Shell />
    </LearnerProvider>
  );
}

function Shell() {
  const { state, beat } = useLearner();
  const collapsed = state.ui.graphCollapsed;
  const inStudio = state.ui.mode === "studio";

  // First visit: the walkthrough's welcome card opens by itself.
  useEffect(() => {
    if (shouldAutoOpen()) tourStore.open();
  }, []);

  return (
    <div className="relative flex h-dvh flex-col overflow-clip bg-bg text-ink">
      <Header onHelp={() => tourStore.open()} />
      <div className="flex min-h-0 flex-1">
        <main className="relative flex min-w-0 flex-1 flex-col" data-testid="main-region">
          {inStudio ? <StudioView /> : <WorkPanel />}
          {beat && !inStudio ? <BeatOverlay /> : null}
        </main>
        <aside
          className={`shrink-0 border-l border-rule bg-panel transition-[width] duration-200 ${
            collapsed ? "w-[72px]" : "w-[44%] max-w-[600px] min-w-[360px]"
          }`}
          data-testid="graph-region"
        >
          <GraphPanel />
        </aside>
      </div>
      <Tour />
    </div>
  );
}
