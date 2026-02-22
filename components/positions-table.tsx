"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PositionDetailDialog } from "@/components/entry-detail-dialog";
import { PositionFilterBar } from "@/components/filter-bar";
import { fetchPositions, parsePosition } from "@/lib/polymarket-api";
import { formatNumber, formatPrice, formatUSD, positionStatus, parseCloseTimeFromTitle } from "@/lib/format";
import { POLL_INTERVAL_POSITIONS } from "@/lib/constants";
import { usePositionSort, useFilterStore } from "@/lib/stores/filter-store";
import { usePositionFilter } from "@/lib/stores/filter-store";
import { filterPositions, sortPositions } from "@/lib/shared/filters";
import type { PositionSortField, SortDirection } from "@/lib/shared/filters";
import { useMarketEndDates } from "@/lib/hooks/use-market-end-date";
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import type { Position } from "@/lib/types";

function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  const totalSeconds = Math.floor(abs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
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

function EndDateBadge({ endDate }: { endDate: string | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());

  const end = endDate ? new Date(endDate).getTime() : NaN;
  const isFuture = !isNaN(end) && end > Date.now();

  useEffect(() => {
    if (!isFuture) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isFuture]);

  if (!endDate || isNaN(end)) return null;

  const remaining = end - now;

  if (remaining > 0) {
    const color =
      remaining < 3600_000 ? "text-red-400" :
      remaining < 86400_000 ? "text-amber-400" :
      "text-neutral-500";
    return (
      <span className={`flex items-center gap-0.5 font-mono text-[10px] ${color}`} title={`Closes: ${new Date(endDate).toLocaleString()}`}>
        <Clock className="size-2.5" />
        {formatDuration(remaining)}
      </span>
    );
  }

  const ago = Math.abs(remaining);
  return (
    <span className="flex items-center gap-0.5 font-mono text-[10px] text-neutral-600" title={`Closed: ${new Date(endDate).toLocaleString()}`}>
      <Clock className="size-2.5" />
      {formatDuration(ago)} ago
    </span>
  );
}

function outcomeBadgeStyle(outcome: string): string {
  const lower = outcome.toLowerCase();
  if (lower === "up" || lower === "yes")
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  if (lower === "down" || lower === "no")
    return "border-red-500/30 bg-red-500/10 text-red-400";
  return "border-neutral-500/30 bg-neutral-500/10 text-neutral-400";
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  return (
    <Badge
      variant="outline"
      className={`shrink-0 text-[9px] px-1 py-0 ${outcomeBadgeStyle(outcome)}`}
    >
      {outcome}
    </Badge>
  );
}

function polymarketUrl(pos: Position): string | null {
  if (pos.eventSlug) return `https://polymarket.com/event/${pos.eventSlug}`;
  if (pos.slug) return `https://polymarket.com/event/${pos.slug}`;
  return null;
}

function PositionRow({
  pos,
  gammaEndDate,
  onClick,
}: {
  pos: Position;
  gammaEndDate?: string;
  onClick: () => void;
}) {
  // Gamma API endDate is most accurate; fall back to title parsing
  const closeTime = gammaEndDate ?? parseCloseTimeFromTitle(pos.title) ?? undefined;
  const status = positionStatus(pos.redeemable, pos.curPrice, closeTime);
  const url = polymarketUrl(pos);

  return (
    <div
      className="flex items-center justify-between gap-2 text-xs cursor-pointer hover:bg-neutral-800/50 rounded px-1 -mx-1 py-0.5"
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <Badge
          variant="outline"
          className={`shrink-0 text-[9px] px-1 py-0 ${status.className}`}
        >
          {status.label}
        </Badge>
        <span className="text-neutral-300 truncate max-w-[180px]">
          {pos.title}
        </span>
        <OutcomeBadge outcome={pos.outcome} />
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-neutral-600 hover:text-blue-400 transition-colors"
            title="Open on Polymarket"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <EndDateBadge endDate={closeTime} />
        <span className="text-neutral-400">
          {formatNumber(pos.size)} @ {formatPrice(pos.avgPrice)}
        </span>
        <span
          className={
            pos.unrealizedPnl >= 0
              ? "text-emerald-400"
              : "text-red-400"
          }
        >
          {pos.unrealizedPnl >= 0 ? "+" : ""}
          {formatUSD(pos.unrealizedPnl)}
        </span>
      </div>
    </div>
  );
}

export function PositionsTable({ address }: { address: string }) {
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    position: Position;
    snapshotAt: number;
  } | null>(null);
  const positionFilter = usePositionFilter(address);
  const positionSort = usePositionSort(address);
  const setPositionSort = useFilterStore((s) => s.setPositionSort);

  const { data: allPositions } = useQuery({
    queryKey: ["positions", address],
    queryFn: async () => {
      const raw = await fetchPositions(address);
      return raw
        .map(parsePosition)
        .filter((p: Position) => p.size > 0.01);
    },
    refetchInterval: POLL_INTERVAL_POSITIONS,
  });

  // Batch-fetch per-market endDates from Gamma API
  const slugs = useMemo(() => {
    if (!allPositions) return [];
    return [...new Set(allPositions.map((p) => p.slug).filter(Boolean))].sort();
  }, [allPositions]);
  const { data: endDateMap } = useMarketEndDates(slugs);

  // Apply filters then sort (using Gamma endDates for accurate ordering)
  const positions = useMemo(() => {
    if (!allPositions) return undefined;
    const filtered = filterPositions(allPositions, positionFilter);
    return sortPositions(filtered, positionSort, endDateMap);
  }, [allPositions, positionFilter, positionSort, endDateMap]);

  const handlePositionSort = (field: string) => {
    const f = field as PositionSortField;
    if (positionSort.field === f) {
      setPositionSort(address, {
        field: f,
        direction: positionSort.direction === "desc" ? "asc" : "desc",
      });
    } else {
      // End Date defaults to ASC (soonest ending first); others default to DESC
      setPositionSort(address, { field: f, direction: f === "endDate" ? "asc" : "desc" });
    }
  };

  const isStale = useMemo(() => {
    if (!snapshot || !allPositions) return false;
    const key = `${snapshot.position.conditionId}-${snapshot.position.outcome}`;
    const live = allPositions.find((p) => `${p.conditionId}-${p.outcome}` === key);
    if (!live) return true;
    return (
      live.size !== snapshot.position.size ||
      live.curPrice !== snapshot.position.curPrice ||
      live.marketValue !== snapshot.position.marketValue ||
      live.unrealizedPnl !== snapshot.position.unrealizedPnl
    );
  }, [snapshot, allPositions]);

  if (!allPositions || allPositions.length === 0) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-medium text-neutral-400">
            Positions (0)
          </span>
        </div>
        <div className="text-xs text-neutral-500 py-2">
          No open positions
        </div>
      </div>
    );
  }

  const filteredCount = positions?.length ?? 0;
  const totalCount = allPositions.length;
  const visible = expanded
    ? (positions ?? [])
    : (positions ?? []).slice(0, 10);

  const positionRows = (
    <div className="space-y-1">
      {/* Column headers */}
      <div className="flex items-center justify-between gap-2 text-[10px] px-1 -mx-1 py-0.5 border-b border-neutral-800/50">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="shrink-0 w-[52px] text-neutral-600">Status</span>
          <span className="text-neutral-600 truncate max-w-[180px]">Market</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <SortHeader label="End Date" field="endDate" activeField={positionSort.field} direction={positionSort.direction} onSort={handlePositionSort} />
          <SortHeader label="Value" field="marketValue" activeField={positionSort.field} direction={positionSort.direction} onSort={handlePositionSort} />
          <SortHeader label="PnL" field="unrealizedPnl" activeField={positionSort.field} direction={positionSort.direction} onSort={handlePositionSort} />
          <SortHeader label="Return" field="percentPnl" activeField={positionSort.field} direction={positionSort.direction} onSort={handlePositionSort} />
        </div>
      </div>
      {visible.map((pos) => (
        <PositionRow
          key={`${pos.conditionId}-${pos.outcome}`}
          pos={pos}
          gammaEndDate={endDateMap?.[pos.slug]}
          onClick={() => setSnapshot({ position: { ...pos }, snapshotAt: Date.now() })}
        />
      ))}
    </div>
  );

  return (
    <>
      <div className="space-y-1">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-neutral-400">
              Positions ({filteredCount}{filteredCount !== totalCount ? `/${totalCount}` : ""})
            </span>
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0 border-purple-500/20 bg-purple-500/5 text-purple-400/70"
            >
              Data API
            </Badge>
          </div>
          {filteredCount > 10 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[10px] h-5 px-2 text-neutral-500 hover:text-neutral-300"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Show less" : `Show all (${filteredCount})`}
            </Button>
          )}
        </div>
        <PositionFilterBar address={address} />
        {expanded ? (
          <ScrollArea className="max-h-[70vh]">{positionRows}</ScrollArea>
        ) : (
          positionRows
        )}
      </div>
      {snapshot && (
        <PositionDetailDialog
          position={snapshot.position}
          open={!!snapshot}
          onOpenChange={(open) => {
            if (!open) setSnapshot(null);
          }}
          snapshotAt={snapshot.snapshotAt}
          isStale={isStale}
        />
      )}
    </>
  );
}
