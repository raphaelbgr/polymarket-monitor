"use client";

import { useAgentStore } from "@/lib/stores/agent-store";

function formatPrice(price: number): string {
  if (price >= 1000) return `$${(price / 1000).toFixed(price >= 10000 ? 0 : 1)}k`;
  return `$${price.toLocaleString()}`;
}

export function PredictionSummary() {
  const predictions = useAgentStore((s) => s.predictions);

  const latest = predictions[0];
  const resolved = predictions.filter((p) => p.resolved);
  const correct = resolved.filter((p) => p.was_correct);
  const active = predictions.filter((p) => !p.resolved);

  if (!latest) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-600">
        No predictions yet
      </div>
    );
  }

  const dirColor =
    latest.direction === "up"
      ? "text-emerald-400"
      : latest.direction === "down"
        ? "text-red-400"
        : "text-neutral-400";

  const arrow =
    latest.direction === "up"
      ? "\u25B2"
      : latest.direction === "down"
        ? "\u25BC"
        : "\u25C6";

  const confPct = Math.round(latest.confidence * 100);
  const accPct = resolved.length > 0 ? Math.round((correct.length / resolved.length) * 100) : 0;

  // Confidence bar color
  const barColor =
    confPct >= 70 ? "bg-emerald-500" : confPct >= 40 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-[#222]">
      {/* Latest prediction */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-neutral-500">BTC</span>
        <span className="text-neutral-600">{"\u2192"}</span>
        <span className={`font-medium ${dirColor}`}>
          {arrow} {formatPrice(latest.predicted_price)}
        </span>
        <span className="text-neutral-600">({confPct}%)</span>
      </div>

      {/* Confidence bar */}
      <div className="w-16 h-1.5 rounded-full bg-neutral-800 overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${confPct}%` }}
        />
      </div>

      {/* Stats */}
      {resolved.length > 0 && (
        <span className="text-[10px] text-neutral-500">
          {correct.length}/{resolved.length} ({accPct}%)
        </span>
      )}

      {active.length > 0 && (
        <span className="text-[10px] text-violet-400">
          {active.length} active
        </span>
      )}
    </div>
  );
}
