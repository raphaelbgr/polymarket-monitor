"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchPositions, parsePosition } from "@/lib/polymarket-api";
import { POLL_INTERVAL_POSITIONS } from "@/lib/constants";
import type { Position } from "@/lib/types";

export function PositionsTable({ address }: { address: string }) {
  const { data: positions } = useQuery({
    queryKey: ["positions", address],
    queryFn: async () => {
      const raw = await fetchPositions(address);
      return raw
        .map(parsePosition)
        .filter((p: Position) => p.size > 0.01)
        .sort((a: Position, b: Position) => b.marketValue - a.marketValue);
    },
    refetchInterval: POLL_INTERVAL_POSITIONS,
  });

  if (!positions || positions.length === 0) {
    return (
      <div className="text-xs text-neutral-500 py-2">
        No open positions
      </div>
    );
  }

  const visible = positions.slice(0, 10);
  const overflow = positions.length - 10;

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-neutral-400 mb-1">
        Positions ({positions.length})
      </div>
      <div className="space-y-1">
        {visible.map((pos) => (
          <div
            key={`${pos.conditionId}-${pos.outcome}`}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-neutral-300 truncate max-w-[180px]">
                {pos.title}
              </span>
              <span className="text-neutral-500 shrink-0">
                {pos.outcome}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-neutral-400">
                {pos.size.toFixed(2)} @ {pos.avgPrice.toFixed(3)}
              </span>
              <span
                className={
                  pos.unrealizedPnl >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }
              >
                {pos.unrealizedPnl >= 0 ? "+" : ""}
                ${pos.unrealizedPnl.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
      </div>
      {overflow > 0 && (
        <div className="text-xs text-neutral-500 pt-1">
          +{overflow} more
        </div>
      )}
    </div>
  );
}
