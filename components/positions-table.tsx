"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PositionDetailDialog } from "@/components/entry-detail-dialog";
import { PositionFilterBar } from "@/components/filter-bar";
import { fetchPositions, parsePosition } from "@/lib/polymarket-api";
import { formatNumber, formatPrice, formatUSD, positionStatus } from "@/lib/format";
import { POLL_INTERVAL_POSITIONS } from "@/lib/constants";
import { usePositionFilter } from "@/lib/stores/filter-store";
import { filterPositions } from "@/lib/shared/filters";
import type { Position } from "@/lib/types";

function polymarketUrl(pos: Position): string | null {
  if (pos.eventSlug) return `https://polymarket.com/event/${pos.eventSlug}`;
  if (pos.slug) return `https://polymarket.com/event/${pos.slug}`;
  return null;
}

export function PositionsTable({ address }: { address: string }) {
  const [expanded, setExpanded] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    position: Position;
    snapshotAt: number;
  } | null>(null);
  const positionFilter = usePositionFilter(address);

  const { data: allPositions } = useQuery({
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

  // Apply filters
  const positions = useMemo(
    () =>
      allPositions
        ? filterPositions(allPositions, positionFilter)
        : undefined,
    [allPositions, positionFilter],
  );

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
      {visible.map((pos) => {
        const url = polymarketUrl(pos);
        const status = positionStatus(pos.redeemable, pos.curPrice);
        return (
          <div
            key={`${pos.conditionId}-${pos.outcome}`}
            className="flex items-center justify-between gap-2 text-xs cursor-pointer hover:bg-neutral-800/50 rounded px-1 -mx-1 py-0.5"
            onClick={() => setSnapshot({ position: { ...pos }, snapshotAt: Date.now() })}
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
              <span className="text-neutral-500 shrink-0">
                {pos.outcome}
              </span>
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
      })}
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
