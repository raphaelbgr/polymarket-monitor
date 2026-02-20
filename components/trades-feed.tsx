"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useTradeStore } from "@/lib/stores/trade-store";
import type { Trade } from "@/lib/types";

function RelativeAge({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const diffMs = now - timestamp * 1000;
  const diffS = Math.max(0, Math.floor(diffMs / 1000));

  if (diffS < 60) return <span>{diffS}s ago</span>;
  if (diffS < 3600) return <span>{Math.floor(diffS / 60)}m ago</span>;
  return <span>{Math.floor(diffS / 3600)}h ago</span>;
}

const sourceBadgeColors: Record<string, string> = {
  WS: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  POLL: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

export function TradesFeed({ address }: { address: string }) {
  const trades = useTradeStore((s) => s.getTradesForWallet(address));

  if (trades.length === 0) {
    return (
      <div className="text-xs text-neutral-500 py-2">
        Waiting for trades...
      </div>
    );
  }

  const visible = trades.slice(0, 15);

  return (
    <div className="space-y-1">
      <div className="text-xs font-medium text-neutral-400 mb-1">
        Trades ({trades.length})
      </div>
      <div className="space-y-1">
        {visible.map((trade: Trade) => (
          <div
            key={trade.transactionHash}
            className="flex items-center gap-2 text-xs"
          >
            <Badge
              variant="outline"
              className={`shrink-0 text-[10px] px-1.5 py-0 ${
                sourceBadgeColors[trade.source] || sourceBadgeColors.POLL
              }`}
            >
              {trade.source}
            </Badge>
            <span
              className={`shrink-0 font-medium ${
                trade.side === "BUY"
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {trade.side}
            </span>
            <span className="text-neutral-400 shrink-0">
              {trade.outcome}
            </span>
            <span className="text-neutral-300 shrink-0">
              {trade.size.toFixed(2)} @ {trade.price.toFixed(3)}
            </span>
            <span className="text-neutral-500 truncate min-w-0">
              {trade.title}
            </span>
            <span className="text-neutral-500 shrink-0 ml-auto">
              <RelativeAge timestamp={trade.timestamp} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
