"use client";

import dynamic from "next/dynamic";

// The app keeps its state in the browser, so it renders client-side only.
const App = dynamic(() => import("@/components/App"), {
  ssr: false,
  loading: () => (
    <div className="flex h-screen items-center justify-center bg-bg text-sm text-ink-2" data-testid="loading">
      Loading Helm…
    </div>
  ),
});

export default function Page() {
  return <App />;
}
