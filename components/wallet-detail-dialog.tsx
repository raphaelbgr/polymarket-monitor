"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  fetchLeaderboard,
  fetchPortfolioValue,
  fetchPositions,
  fetchBalance,
  parsePosition,
} from "@/lib/polymarket-api";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useShallow } from "zustand/react/shallow";
import {
  formatUSD,
  formatNumber,
  formatPrice,
  formatTimeWithAge,
  positionStatus,
} from "@/lib/format";
import type { TrackedWallet, Position, Trade } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ExactTime({ timestamp }: { timestamp: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="font-mono">{formatTimeWithAge(timestamp, now)}</span>
  );
}

type PosFilter = "all" | "active" | "resolved" | "won" | "lost";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WalletDetailDialog({
  wallet,
  open,
  onOpenChange,
}: {
  wallet: TrackedWallet;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addr = wallet.address;

  // --- data queries (only fire when dialog is open) ---
  const { data: leaderboard } = useQuery({
    queryKey: ["leaderboard", addr],
    queryFn: () => fetchLeaderboard(addr),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: portfolioValue } = useQuery({
    queryKey: ["portfolio-value", addr],
    queryFn: () => fetchPortfolioValue(addr),
    enabled: open,
    staleTime: 60_000,
  });

  const { data: positions } = useQuery({
    queryKey: ["positions-full", addr],
    queryFn: async () => {
      const raw = await fetchPositions(addr);
      return raw
        .map(parsePosition)
        .filter((p) => p.size > 0.01)
        .sort((a, b) => b.marketValue - a.marketValue);
    },
    enabled: open,
    staleTime: 30_000,
  });

  const { data: balance } = useQuery({
    queryKey: ["balance", addr],
    queryFn: () => fetchBalance(addr),
    enabled: open,
  });

  const trades = useTradeStore(
    useShallow((s) => s.tradesByWallet[addr.toLowerCase()] ?? [])
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] bg-[#0c0c0c] border-[#222] text-neutral-100 overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">
            {wallet.label}
          </DialogTitle>
          <span className="font-mono text-[10px] text-neutral-500">
            {addr}
          </span>
        </DialogHeader>

        <Tabs defaultValue="overview" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="bg-[#111] border-b border-[#222] shrink-0">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="positions">Positions</TabsTrigger>
            <TabsTrigger value="trades">Trades</TabsTrigger>
          </TabsList>

          {/* --- Overview ------------------------------------------------ */}
          <TabsContent value="overview" className="flex-1 overflow-auto mt-0 pt-4">
            <OverviewTab
              leaderboard={leaderboard ?? null}
              portfolioValue={portfolioValue ?? 0}
              balance={balance}
              positions={positions ?? []}
            />
          </TabsContent>

          {/* --- Positions ----------------------------------------------- */}
          <TabsContent value="positions" className="flex-1 overflow-hidden mt-0 pt-4">
            <PositionsTab positions={positions ?? []} />
          </TabsContent>

          {/* --- Trades -------------------------------------------------- */}
          <TabsContent value="trades" className="flex-1 overflow-hidden mt-0 pt-4">
            <TradesTab trades={trades} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Overview Tab
// ---------------------------------------------------------------------------

function OverviewTab({
  leaderboard,
  portfolioValue,
  balance,
  positions,
}: {
  leaderboard: Awaited<ReturnType<typeof fetchLeaderboard>>;
  portfolioValue: number;
  balance: number | undefined;
  positions: Position[];
}) {
  const activeCount = positions.filter((p) => !p.redeemable).length;
  const resolvedCount = positions.filter((p) => p.redeemable).length;

  const won = positions.filter((p) => p.redeemable && p.curPrice >= 0.95);
  const lost = positions.filter((p) => p.redeemable && p.curPrice <= 0.05);
  const wonPnl = won.reduce((s, p) => s + p.cashPnl, 0);
  const lostPnl = lost.reduce((s, p) => s + p.cashPnl, 0);

  return (
    <div className="space-y-5 text-xs">
      {/* Profile */}
      <Section title="Profile">
        <Row label="Username" value={leaderboard?.userName || "—"} />
        <Row label="Rank" value={leaderboard ? `#${formatNumber(leaderboard.rank, 0)}` : "—"} />
        <Row
          label="USDC.e Balance"
          value={balance !== undefined ? formatUSD(balance) : "—"}
        />
        <Row label="Portfolio Value" value={formatUSD(portfolioValue)} />
      </Section>

      <Separator className="bg-[#222]" />

      {/* All-Time Stats */}
      <Section title="All-Time Stats">
        <Row
          label="Total Volume"
          value={leaderboard ? formatUSD(leaderboard.vol) : "—"}
        />
        <Row
          label="All-Time PnL"
          value={
            leaderboard ? (
              <span
                className={
                  leaderboard.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                }
              >
                {leaderboard.pnl >= 0 ? "+" : ""}
                {formatUSD(leaderboard.pnl)}
              </span>
            ) : (
              "—"
            )
          }
        />
      </Section>

      <Separator className="bg-[#222]" />

      {/* Positions Breakdown */}
      <Section title="Current Positions">
        <Row
          label="Active / Resolved"
          value={`${activeCount} / ${resolvedCount}`}
        />
        <Row
          label="Won"
          value={
            <span className="text-emerald-400">
              {won.length} ({won.length > 0 ? "+" : ""}
              {formatUSD(wonPnl)})
            </span>
          }
        />
        <Row
          label="Lost"
          value={
            <span className="text-red-400">
              {lost.length} ({formatUSD(lostPnl)})
            </span>
          }
        />
      </Section>

      <Separator className="bg-[#222]" />

      {/* Data Sources */}
      <Section title="Data Sources">
        <div className="space-y-1 text-neutral-500">
          <div>Polymarket Data API (data-api.polymarket.com)</div>
          <div>Polygon RPC (polygon-bor-rpc.publicnode.com)</div>
          <div>RTDS WebSocket (ws-live-data.polymarket.com)</div>
        </div>
      </Section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Positions Tab
// ---------------------------------------------------------------------------

function PositionsTab({ positions }: { positions: Position[] }) {
  const [filter, setFilter] = useState<PosFilter>("all");

  const filtered = useMemo(() => {
    switch (filter) {
      case "active":
        return positions.filter((p) => !p.redeemable);
      case "resolved":
        return positions.filter((p) => p.redeemable);
      case "won":
        return positions.filter((p) => p.redeemable && p.curPrice >= 0.95);
      case "lost":
        return positions.filter((p) => p.redeemable && p.curPrice <= 0.05);
      default:
        return positions;
    }
  }, [positions, filter]);

  const filters: { key: PosFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "resolved", label: "Resolved" },
    { key: "won", label: "Won" },
    { key: "lost", label: "Lost" },
  ];

  return (
    <div className="flex flex-col gap-2 h-full overflow-hidden">
      <div className="flex items-center gap-1 shrink-0">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={filter === f.key ? "secondary" : "ghost"}
            size="sm"
            className="text-[10px] h-6 px-2"
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Button>
        ))}
        <span className="ml-auto text-[10px] text-neutral-500">
          {filtered.length} positions
        </span>
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {filtered.map((pos) => (
            <div
              key={`${pos.conditionId}-${pos.outcome}`}
              className="flex items-center justify-between gap-2 text-xs py-0.5"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {(() => {
                  const status = positionStatus(pos.redeemable, pos.curPrice);
                  return (
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[9px] px-1 py-0 ${status.className}`}
                    >
                      {status.label}
                    </Badge>
                  );
                })()}
                <span className="text-neutral-300 truncate max-w-[200px]">
                  {pos.title}
                </span>
                <span className="text-neutral-500 shrink-0">
                  {pos.outcome}
                </span>
                {(pos.eventSlug || pos.slug) && (
                  <a
                    href={`https://polymarket.com/event/${pos.eventSlug || pos.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-neutral-600 hover:text-blue-400 transition-colors"
                    title="Open on Polymarket"
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
                    pos.cashPnl >= 0 ? "text-emerald-400" : "text-red-400"
                  }
                >
                  {pos.cashPnl >= 0 ? "+" : ""}
                  {formatUSD(pos.cashPnl)}
                </span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-neutral-500 text-xs py-4 text-center">
              No positions match this filter
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trades Tab
// ---------------------------------------------------------------------------

const sourceBadgeColors: Record<string, string> = {
  WS: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  POLL: "border-purple-500/30 bg-purple-500/10 text-purple-400",
};

function TradesTab({ trades }: { trades: Trade[] }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="text-[10px] text-neutral-500 mb-2 shrink-0">
        {trades.length} trades in memory
      </div>
      <ScrollArea className="flex-1">
        <div className="space-y-1">
          {trades.map((trade) => (
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
                {formatUSD(trade.size)} @ {formatPrice(trade.price)}
              </span>
              <span className="text-neutral-500 truncate min-w-0">
                {trade.title}
              </span>
              <span className="text-neutral-500 shrink-0 ml-auto text-[10px]">
                <ExactTime timestamp={trade.timestamp} />
              </span>
            </div>
          ))}
          {trades.length === 0 && (
            <div className="text-neutral-500 text-xs py-4 text-center">
              No trades recorded yet
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Micro-components
// ---------------------------------------------------------------------------

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-400">{label}</span>
      <span className="text-neutral-200">{value}</span>
    </div>
  );
}
