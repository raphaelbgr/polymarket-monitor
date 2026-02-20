"use client";

import { useState } from "react";
import { ExternalLink, Copy, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatUSD, formatPrice, formatNumber, formatDateTime, formatTime, positionStatus } from "@/lib/format";
import type { Trade, Position } from "@/lib/types";

function SnapshotInfo({ snapshotAt, isStale }: { snapshotAt?: number; isStale?: boolean }) {
  if (!snapshotAt) return null;
  return (
    <div className="border-t border-neutral-800 pt-2 space-y-1.5">
      {isStale && (
        <div className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-1">
          Data may have changed since this snapshot was taken
        </div>
      )}
      <div className="text-[10px] text-neutral-600">
        Snapshot at {formatTime(snapshotAt / 1000)}
      </div>
    </div>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-neutral-500 text-xs shrink-0 w-24">{label}</span>
      <button
        onClick={copy}
        className="flex items-center gap-1 text-xs text-neutral-300 font-mono min-w-0 hover:text-white transition-colors"
        title="Click to copy"
      >
        <span className="truncate">{value}</span>
        {copied ? (
          <Check className="size-3 text-emerald-400 shrink-0" />
        ) : (
          <Copy className="size-3 text-neutral-600 shrink-0" />
        )}
      </button>
    </div>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-neutral-500 text-xs shrink-0">{label}</span>
      <span className={`text-xs text-right truncate ${className ?? "text-neutral-300"}`}>{value}</span>
    </div>
  );
}

function PnlField({ label, value }: { label: string; value: number }) {
  return (
    <Field
      label={label}
      value={`${value >= 0 ? "+" : ""}${formatUSD(value)}`}
      className={value >= 0 ? "text-emerald-400" : "text-red-400"}
    />
  );
}

// ── Trade Detail ──────────────────────────────────────────────

export function TradeDetailDialog({
  trade,
  open,
  onOpenChange,
  snapshotAt,
}: {
  trade: Trade;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshotAt?: number;
}) {
  const polygonUrl = `https://polygonscan.com/tx/${trade.transactionHash}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-neutral-900 border-neutral-800 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-sm text-neutral-200">
            Trade Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-hidden">
          {/* Title + Outcome */}
          <div className="space-y-1">
            <p className="text-sm text-neutral-200 leading-tight break-words">{trade.title}</p>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  trade.side === "BUY"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/30 bg-red-500/10 text-red-400"
                }`}
              >
                {trade.side}
              </Badge>
              <span className="text-xs text-neutral-400">{trade.outcome}</span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 ${
                  trade.source === "WS"
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-400"
                    : "border-purple-500/30 bg-purple-500/10 text-purple-400"
                }`}
              >
                {trade.source}
              </Badge>
            </div>
          </div>

          {/* Fields */}
          <div className="space-y-1.5 border-t border-neutral-800 pt-3">
            <Field label="Amount" value={formatUSD(trade.size)} />
            <Field label="Price" value={formatPrice(trade.price)} />
            <Field
              label="Shares"
              value={formatNumber(trade.price > 0 ? trade.size / trade.price : 0, 2)}
            />
            <Field label="Time" value={formatDateTime(trade.timestamp)} />
          </div>

          {/* IDs */}
          <div className="space-y-1.5 border-t border-neutral-800 pt-3">
            <CopyField label="Tx Hash" value={trade.transactionHash} />
            <CopyField label="Condition ID" value={trade.conditionId} />
            <CopyField label="Wallet" value={trade.walletAddress} />
          </div>

          {/* Links */}
          <div className="border-t border-neutral-800 pt-3">
            <a
              href={polygonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              <ExternalLink className="size-3" />
              View on PolygonScan
            </a>
          </div>

          <SnapshotInfo snapshotAt={snapshotAt} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Position Detail ───────────────────────────────────────────

export function PositionDetailDialog({
  position,
  open,
  onOpenChange,
  snapshotAt,
  isStale,
}: {
  position: Position;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshotAt?: number;
  isStale?: boolean;
}) {
  const polyUrl = position.eventSlug
    ? `https://polymarket.com/event/${position.eventSlug}`
    : position.slug
      ? `https://polymarket.com/event/${position.slug}`
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-neutral-900 border-neutral-800 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="text-sm text-neutral-200">
            Position Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-hidden">
          {/* Title + Status */}
          <div className="space-y-1">
            <p className="text-sm text-neutral-200 leading-tight break-words">{position.title}</p>
            <div className="flex items-center gap-2">
              {(() => {
                const status = positionStatus(position.redeemable, position.curPrice);
                return (
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${status.className}`}
                  >
                    {status.label}
                  </Badge>
                );
              })()}
              <span className="text-xs text-neutral-400">{position.outcome}</span>
            </div>
          </div>

          {/* Core position data */}
          <div className="space-y-1.5 border-t border-neutral-800 pt-3">
            <Field label="Shares" value={formatNumber(position.size)} />
            <Field label="Avg Price" value={formatPrice(position.avgPrice)} />
            <Field label="Current Price" value={formatPrice(position.curPrice)} />
            <Field label="Market Value" value={formatUSD(position.marketValue)} />
          </div>

          {/* Cost basis & PnL */}
          <div className="space-y-1.5 border-t border-neutral-800 pt-3">
            {position.initialValue > 0 && (
              <Field label="Cost Basis" value={formatUSD(position.initialValue)} />
            )}
            {position.currentValue > 0 && (
              <Field label="Current Value" value={formatUSD(position.currentValue)} />
            )}
            {position.totalBought > 0 && (
              <Field label="Total Bought" value={formatUSD(position.totalBought)} />
            )}
            <PnlField label="Unrealized PnL" value={position.unrealizedPnl} />
            {position.cashPnl !== 0 && (
              <PnlField label="Cash PnL" value={position.cashPnl} />
            )}
            {position.realizedPnl !== 0 && (
              <PnlField label="Realized PnL" value={position.realizedPnl} />
            )}
            {position.percentPnl !== 0 && (
              <Field
                label="Return"
                value={`${position.percentPnl >= 0 ? "+" : ""}${position.percentPnl.toFixed(1)}%`}
                className={position.percentPnl >= 0 ? "text-emerald-400" : "text-red-400"}
              />
            )}
          </div>

          {/* Dates */}
          {position.endDate && (
            <div className="space-y-1.5 border-t border-neutral-800 pt-3">
              <Field label="End Date" value={position.endDate} />
            </div>
          )}

          {/* IDs */}
          <div className="space-y-1.5 border-t border-neutral-800 pt-3">
            <CopyField label="Condition ID" value={position.conditionId} />
            <CopyField label="Asset" value={position.asset} />
          </div>

          {/* Links */}
          {polyUrl && (
            <div className="border-t border-neutral-800 pt-3">
              <a
                href={polyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="size-3" />
                Open on Polymarket
              </a>
            </div>
          )}

          <SnapshotInfo snapshotAt={snapshotAt} isStale={isStale} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
