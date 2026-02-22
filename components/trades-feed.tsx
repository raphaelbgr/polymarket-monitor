"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TradeDetailDialog } from "@/components/entry-detail-dialog";
import { TradeFilterBar } from "@/components/filter-bar";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useTradeFilter, useTradeSort, useFilterStore } from "@/lib/stores/filter-store";
import { useShallow } from "zustand/react/shallow";
import { formatTimeWithAge, formatUSD, formatPrice } from "@/lib/format";
import { filterTrades, sortTrades } from "@/lib/shared/filters";
import type { TradeSortField, SortDirection } from "@/lib/shared/filters";
import type { Trade } from "@/lib/types";

function ExactTime({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  return <span>{formatTimeWithAge(timestamp, now)}</span>;
}

function SortHeader({
  label,
  field,
  activeField,
  direction,
  onSort,
}: {
  label: string;
  field: string;
  activeField: string;
  direction: SortDirection;
  onSort: (field: string) => void;
}) {
  const isActive = field === activeField;
  return (
    <button
      onClick={() => onSort(field)}
      className={`flex items-center gap-0.5 text-[10px] hover:text-neutral-200 transition-colors ${
        isActive ? "text-neutral-200" : "text-neutral-500"
      }`}
    >
      {label}
      {isActive ? (
        direction === "desc" ? (
          <ArrowDown className="size-2.5" />
        ) : (
          <ArrowUp className="size-2.5" />
        )
      ) : (
        <ArrowUpDown className="size-2.5 opacity-40" />
      )}
    </button>
  );
}

const sourceBadgeColors: Record<string, string> = {
  WS: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  POLL: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

export function TradesFeed({ address }: { address: string }) {
  const trades = useTradeStore(
    useShallow((s) => s.tradesByWallet[address.toLowerCase()] ?? [])
  );
  const tradeFilter = useTradeFilter(address);
  const tradeSort = useTradeSort(address);
  const setTradeSort = useFilterStore((s) => s.setTradeSort);
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    trade: Trade;
    snapshotAt: number;
  } | null>(null);

  // Apply filters then sort
  const filtered = useMemo(() => {
    const f = filterTrades(trades, tradeFilter);
    return sortTrades(f, tradeSort);
  }, [trades, tradeFilter, tradeSort]);

  const handleTradeSort = (field: string) => {
    const f = field as TradeSortField;
    if (tradeSort.field === f) {
      setTradeSort(address, {
        field: f,
        direction: tradeSort.direction === "desc" ? "asc" : "desc",
      });
    } else {
      // End time defaults to ASC (soonest ending first); others default to DESC
      setTradeSort(address, { field: f, direction: f === "endTime" ? "asc" : "desc" });
    }
  };

  if (trades.length === 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-neutral-400">
            Trades (0)
          </span>
        </div>
        <div className="text-xs text-neutral-500 py-2">
          Waiting for trades...
        </div>
      </div>
    );
  }

  const visible = expanded ? filtered : filtered.slice(0, 25);

  const tradeRows = (
    <div className="space-y-1">
      {/* Column headers */}
      <div className="flex items-center gap-2 text-[10px] px-1 -mx-1 py-0.5 border-b border-neutral-800/50">
        <span className="shrink-0 w-[34px] text-neutral-600">Src</span>
        <span className="shrink-0 w-[28px] text-neutral-600">Side</span>
        <span className="text-neutral-600 shrink-0 w-[32px]">Out</span>
        <SortHeader label="Amount" field="size" activeField={tradeSort.field} direction={tradeSort.direction} onSort={handleTradeSort} />
        <SortHeader label="Price" field="price" activeField={tradeSort.field} direction={tradeSort.direction} onSort={handleTradeSort} />
        <SortHeader label="Market" field="title" activeField={tradeSort.field} direction={tradeSort.direction} onSort={handleTradeSort} />
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <SortHeader label="End" field="endTime" activeField={tradeSort.field} direction={tradeSort.direction} onSort={handleTradeSort} />
          <SortHeader label="Time" field="time" activeField={tradeSort.field} direction={tradeSort.direction} onSort={handleTradeSort} />
        </div>
      </div>
      {visible.map((trade: Trade) => (
        <div
          key={trade.transactionHash}
          className="flex items-center gap-2 text-xs cursor-pointer hover:bg-neutral-800/50 rounded px-1 -mx-1 py-0.5"
          onClick={() => setSnapshot({ trade: { ...trade }, snapshotAt: Date.now() })}
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
              Trades ({filtered.length}{filtered.length !== trades.length ? `/${trades.length}` : ""})
            </span>
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 border-blue-500/20 bg-blue-500/5 text-blue-400/70"
            >
              RTDS + Data API
            </Badge>
          </div>
          {filtered.length > 25 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-5 px-2 text-neutral-500 hover:text-neutral-300"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : `Show all (${filtered.length})`}
            </Button>
          )}
        </div>
        <TradeFilterBar address={address} />
        {expanded ? (
          <ScrollArea className="max-h-[70vh]">{tradeRows}</ScrollArea>
        ) : (
          tradeRows
        )}
      </div>
      {snapshot && (
        <TradeDetailDialog
          trade={snapshot.trade}
          open={!!snapshot}
          onOpenChange={(open) => {
            if (!open) setSnapshot(null);
          }}
          snapshotAt={snapshot.snapshotAt}
        />
      )}
    </>
  );
}
