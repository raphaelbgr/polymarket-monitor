"use client";

import Link from "next/link";
import { ASSET_CONFIG, SUPPORTED_ASSETS } from "@/lib/chart/constants";
import { useChartStore } from "@/lib/stores/chart-store";

interface ChartStatusBarProps {
  asset: string;
  binanceConnected: boolean;
  rtdsConnected: boolean;
}

export function ChartStatusBar({
  asset,
  binanceConnected,
  rtdsConnected,
}: ChartStatusBarProps) {
  const config = ASSET_CONFIG[asset];
  const toggleSidebar = useChartStore((s) => s.toggleSidebar);
  const sidebarOpen = useChartStore((s) => s.sidebarOpen);
  const chartStyle = useChartStore((s) => s.chartStyle);
  const toggleChartStyle = useChartStore((s) => s.toggleChartStyle);

  return (
    <div className="sticky top-0 z-50 flex items-center gap-4 border-b border-[#222] bg-[#0a0a0a]/95 px-4 py-2 font-mono text-xs backdrop-blur">
      {/* Back link */}
      <Link
        href="/"
        className="text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        Dashboard
      </Link>
      <span className="text-neutral-600">/</span>

      {/* Asset tabs */}
      <div className="flex items-center gap-2">
        {SUPPORTED_ASSETS.map((a) => (
          <Link
            key={a}
            href={`/chart/${a}`}
            className={`px-2 py-0.5 rounded text-xs transition-colors ${
              a === asset
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {ASSET_CONFIG[a].symbol}
          </Link>
        ))}
      </div>

      {/* Asset label */}
      <span className="text-neutral-100 font-medium">
        {config?.label} Chart
      </span>

      {/* Chart style toggle + Connection indicators */}
      <div className="flex items-center gap-3 ml-auto">
        <button
          onClick={toggleChartStyle}
          className="rounded px-2 py-0.5 text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-200"
          title={chartStyle === "area" ? "Switch to candles" : "Switch to area"}
        >
          {chartStyle === "area" ? "Area" : "Candles"}
        </button>

        <span className="text-neutral-700">|</span>

        <div className="flex items-center gap-1.5">
          <div
            className={`h-2 w-2 rounded-full ${
              binanceConnected ? "bg-emerald-500" : "bg-neutral-600"
            }`}
          />
          <span className="text-neutral-400">Binance</span>
        </div>

        <div className="flex items-center gap-1.5">
          <div
            className={`h-2 w-2 rounded-full ${
              rtdsConnected
                ? "bg-emerald-500"
                : "bg-neutral-600"
            }`}
          />
          <span className="text-neutral-400">RTDS</span>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={toggleSidebar}
          className="text-neutral-400 hover:text-neutral-200 transition-colors px-1"
          title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
        >
          {sidebarOpen ? ">>>" : "<<<"}
        </button>
      </div>
    </div>
  );
}
