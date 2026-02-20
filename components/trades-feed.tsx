"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TradeDetailDialog } from "@/components/entry-detail-dialog";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useShallow } from "zustand/react/shallow";
import { formatTimeWithAge, formatUSD, formatPrice } from "@/lib/format";
import type { Trade } from "@/lib/types";

function ExactTime({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return <span>{formatTimeWithAge(timestamp, now)}</span>;
}

const sourceBadgeColors: Record<string, string> = {
  WS: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  POLL: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

export function TradesFeed({ address }: { address: string }) {
  const trades = useTradeStore(
    useShallow((s) => s.tradesByWallet[address.toLowerCase()] ?? [])
  );
  const [expanded, setExpanded] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);

  if (trades.length === 0) {
    return (
      <div className="text-xs text-neutral-500 py-2">
        Waiting for trades...
      </div>
    );
  }

  const visible = expanded ? trades : trades.slice(0, 25);

  const tradeRows = (
    <div className="space-y-1">
      {visible.map((trade: Trade) => (
        <div
          key={trade.transactionHash}
          className="flex items-center gap-2 text-xs cursor-pointer hover:bg-neutral-800/50 rounded px-1 -mx-1 py-0.5"
          onClick={() => setSelectedTrade(trade)}
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
            {formatUSD(trade.size)} @ {formatPrice(trade.price)}
          </span>
          <span className="text-neutral-500 truncate min-w-0">
            {trade.title}
          </span>
          <span className="text-neutral-500 shrink-0 ml-auto font-mono">
            <ExactTime timestamp={trade.timestamp} />
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-400">
              Trades ({trades.length})
            </span>
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 border-blue-500/20 bg-blue-500/5 text-blue-400/70"
            >
              RTDS + Data API
            </Badge>
          </div>
          {trades.length > 25 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-5 px-2 text-neutral-500 hover:text-neutral-300"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : `Show all (${trades.length})`}
            </Button>
          )}
        </div>
        {expanded ? (
          <ScrollArea className="max-h-[70vh]">{tradeRows}</ScrollArea>
        ) : (
          tradeRows
        )}
      </div>
      {selectedTrade && (
        <TradeDetailDialog
          trade={selectedTrade}
          open={!!selectedTrade}
          onOpenChange={(open) => {
            if (!open) setSelectedTrade(null);
          }}
        />
      )}
    </>
  );
}
