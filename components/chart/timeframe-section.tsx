"use client";

import { ALL_TIMEFRAMES, TIMEFRAME_CONFIG, type Timeframe } from "@/lib/chart/constants";
import { useChartStore } from "@/lib/stores/chart-store";

export function TimeframeSection() {
  const selectedTimeframe = useChartStore((s) => s.selectedTimeframe);
  const setTimeframe = useChartStore((s) => s.setTimeframe);

  return (
    <div className="border-b border-[#222] px-4 py-3">
      <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">
        Timeframe
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {ALL_TIMEFRAMES.map((tf: Timeframe) => {
          const active = selectedTimeframe === tf;
          return (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                active
                  ? "bg-neutral-700 text-neutral-100"
                  : "bg-neutral-900 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              {TIMEFRAME_CONFIG[tf].label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
