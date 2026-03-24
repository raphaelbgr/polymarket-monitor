"use client";

import { useAgentStore } from "@/lib/stores/agent-store";

export function PredictionSection() {
  const showBand = useAgentStore((s) => s.showPredictionBand);
  const toggleBand = useAgentStore((s) => s.togglePredictionBand);
  const showTags = useAgentStore((s) => s.showAITags);
  const toggleTags = useAgentStore((s) => s.toggleAITags);
  const showResolved = useAgentStore((s) => s.showResolvedPredictions);
  const toggleResolved = useAgentStore((s) => s.toggleResolvedPredictions);
  const sseConnected = useAgentStore((s) => s.sseConnected);

  return (
    <div className="px-4 py-3 border-t border-[#222]">
      <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-2">
        AI Predictions
        <div
          className={`h-1.5 w-1.5 rounded-full ${
            sseConnected ? "bg-violet-500" : "bg-neutral-600"
          }`}
        />
      </h3>
      <div className="space-y-1.5">
        <button
          onClick={toggleBand}
          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
            showBand
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
          }`}
        >
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              showBand ? "bg-violet-500" : "bg-neutral-600"
            }`}
          />
          Confidence Band
        </button>

        <button
          onClick={toggleTags}
          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
            showTags
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
          }`}
        >
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              showTags ? "bg-violet-500" : "bg-neutral-600"
            }`}
          />
          AI Tags
        </button>

        <button
          onClick={toggleResolved}
          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ml-4 ${
            showResolved
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
          }`}
        >
          <div
            className={`h-2 w-2 rounded-sm border ${
              showResolved
                ? "border-violet-500 bg-violet-500"
                : "border-neutral-600 bg-transparent"
            }`}
          />
          Resolved Predictions
        </button>
      </div>
    </div>
  );
}
