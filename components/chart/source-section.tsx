"use client";

import { useChartStore } from "@/lib/stores/chart-store";

export function SourceSection() {
  const sources = useChartStore((s) => s.sources);
  const toggleSource = useChartStore((s) => s.toggleSource);
  const showPast = useChartStore((s) => s.showPastPredictions);
  const togglePast = useChartStore((s) => s.togglePastPredictions);

  return (
    <div className="px-4 py-3">
      <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
        Sources
      </h3>
      <div className="space-y-1.5">
        <button
          onClick={() => toggleSource("binance")}
          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
            sources.binance
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
          }`}
        >
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              sources.binance ? "bg-[#f0b90b]" : "bg-neutral-600"
            }`}
          />
          Binance Price
        </button>

        <button
          onClick={() => toggleSource("polymarket")}
          className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ${
            sources.polymarket
              ? "bg-neutral-800 text-neutral-100"
              : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
          }`}
        >
          <div
            className={`h-2.5 w-2.5 rounded-full ${
              sources.polymarket ? "bg-blue-500" : "bg-neutral-600"
            }`}
          />
          Whale Markers
        </button>

        {sources.polymarket && (
          <button
            onClick={togglePast}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors ml-4 ${
              showPast
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:bg-neutral-900 hover:text-neutral-300"
            }`}
          >
            <div
              className={`h-2 w-2 rounded-sm border ${
                showPast
                  ? "border-amber-500 bg-amber-500"
                  : "border-neutral-600 bg-transparent"
              }`}
            />
            Past Predictions
          </button>
        )}
      </div>
    </div>
  );
}
