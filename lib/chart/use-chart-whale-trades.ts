"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useChartStore } from "@/lib/stores/chart-store";
import { detectTags } from "@/lib/shared/tags";
import { parseCloseTimeFromTitle } from "@/lib/shared/format";
import { TIMEFRAME_CONFIG, type Timeframe } from "./constants";
import type { WhaleChartMarker, PredictionTag } from "./types";
import { parsePriceThreshold } from "./market-description";
import type { Trade } from "@/lib/types";

/**
 * Filter trades from the trade store that match:
 * 1. The given asset tag (e.g., "btc")
 * 2. The "directional" tag
 * 3. Are from enabled wallets
 *
 * Returns WhaleChartMarker[] for each timeframe.
 */
export function useChartWhaleTrades(
  assetTag: string,
  walletLabels: Record<string, string>,
): WhaleChartMarker[] {
  const tradesByWallet = useTradeStore(
    useShallow((s) => s.tradesByWallet),
  );
  const enabledWallets = useChartStore((s) => s.enabledWallets);
  const walletColors = useChartStore((s) => s.walletColors);

  return useMemo(() => {
    const markers: WhaleChartMarker[] = [];

    for (const [wallet, trades] of Object.entries(tradesByWallet)) {
      if (!enabledWallets.has(wallet)) continue;

      const color = walletColors[wallet] || "#737373";
      const label = walletLabels[wallet] || wallet.slice(0, 8);

      for (const trade of trades) {
        const tags = detectTags(trade.title);
        if (!tags.includes(assetTag) || !tags.includes("directional")) continue;

        const marker = tradeToMarker(trade, label, color);
        markers.push(marker);
      }
    }

    return markers;
  }, [tradesByWallet, enabledWallets, walletColors, walletLabels, assetTag]);
}

/**
 * Convert a Trade into a WhaleChartMarker.
 *
 * BUY "Up" outcome → green arrow below bar (bullish signal)
 * BUY "Down" outcome → red arrow above bar (bearish signal)
 * SELL (any) → red X above bar
 */
function tradeToMarker(
  trade: Trade,
  walletLabel: string,
  color: string,
): WhaleChartMarker {
  const isUp = /\bup\b/i.test(trade.outcome);
  const isBuy = trade.side === "BUY";

  let shape: WhaleChartMarker["shape"];
  let position: WhaleChartMarker["position"];
  let markerColor: string;

  if (!isBuy) {
    // SELL → red X above bar
    shape = "square";
    position = "aboveBar";
    markerColor = "#ef4444";
  } else if (isUp) {
    // BUY "Up" → green arrow below bar
    shape = "arrowUp";
    position = "belowBar";
    markerColor = color;
  } else {
    // BUY "Down" → red arrow above bar
    shape = "arrowDown";
    position = "aboveBar";
    markerColor = color;
  }

  const sizeStr = trade.size >= 1000
    ? `$${(trade.size / 1000).toFixed(1)}k`
    : `$${trade.size.toFixed(0)}`;

  // Place marker at the market's FUTURE resolution time (not when the trade was made)
  // so you can see where on the timeline whales expect the price to be.
  let markerTime = trade.timestamp;
  const closeIso = parseCloseTimeFromTitle(trade.title);
  if (closeIso) {
    const closeSec = Math.floor(new Date(closeIso).getTime() / 1000);
    if (!isNaN(closeSec)) markerTime = closeSec;
  }

  return {
    time: markerTime,
    position,
    color: markerColor,
    shape,
    text: `${walletLabel} ${trade.side} ${trade.outcome} ${sizeStr}`,
    walletAddress: trade.walletAddress,
    tradeHash: trade.transactionHash,
  };
}

/**
 * Snap marker times to candle boundaries for a given timeframe.
 */
export function snapMarkersToTimeframe(
  markers: WhaleChartMarker[],
  timeframe: Timeframe,
): WhaleChartMarker[] {
  const interval = TIMEFRAME_CONFIG[timeframe].seconds;
  return markers.map((m) => ({
    ...m,
    time: Math.floor(m.time / interval) * interval,
  }));
}

/**
 * Aggregate trades into one PredictionTag per (wallet, conditionId).
 *
 * Groups all trades by wallet+conditionId, sums buy/sell volumes,
 * determines dominant outcome by buy volume, and positions the tag
 * at the market's close time + price threshold.
 */
export function useChartPredictionTags(
  assetTag: string,
  walletLabels: Record<string, string>,
): PredictionTag[] {
  const tradesByWallet = useTradeStore(
    useShallow((s) => s.tradesByWallet),
  );
  const enabledWallets = useChartStore((s) => s.enabledWallets);
  const walletColors = useChartStore((s) => s.walletColors);

  return useMemo(() => {
    const groups = new Map<string, {
      wallet: string;
      conditionId: string;
      title: string;
      trades: Trade[];
    }>();

    for (const [wallet, trades] of Object.entries(tradesByWallet)) {
      if (!enabledWallets.has(wallet)) continue;

      for (const trade of trades) {
        const tags = detectTags(trade.title);
        if (!tags.includes(assetTag) || !tags.includes("directional")) continue;

        const key = `${wallet}:${trade.conditionId}`;
        let group = groups.get(key);
        if (!group) {
          group = { wallet, conditionId: trade.conditionId, title: trade.title, trades: [] };
          groups.set(key, group);
        }
        group.trades.push(trade);
      }
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const result: PredictionTag[] = [];

    for (const [key, group] of groups) {
      let totalBuySize = 0;
      let totalSellSize = 0;
      let buyUpVolume = 0;
      let buyDownVolume = 0;
      let priceWeightedSum = 0;
      let sizeSum = 0;

      for (const t of group.trades) {
        const isBuy = t.side === "BUY";
        if (isBuy) {
          totalBuySize += t.size;
          if (/\bup\b/i.test(t.outcome)) buyUpVolume += t.size;
          else buyDownVolume += t.size;
        } else {
          totalSellSize += t.size;
        }
        priceWeightedSum += t.price * t.size;
        sizeSum += t.size;
      }

      // Parse close time from title
      const closeIso = parseCloseTimeFromTitle(group.title);
      if (!closeIso) continue; // Skip if no parseable close time
      const closeTimeSec = Math.floor(new Date(closeIso).getTime() / 1000);
      if (isNaN(closeTimeSec)) continue;

      const dominantOutcome: "Up" | "Down" = buyUpVolume >= buyDownVolume ? "Up" : "Down";
      const avgPrice = sizeSum > 0 ? priceWeightedSum / sizeSum : 0;
      const threshold = parsePriceThreshold(group.title);

      result.push({
        key,
        walletAddress: group.wallet,
        walletLabel: walletLabels[group.wallet] || group.wallet.slice(0, 8),
        walletColor: walletColors[group.wallet] || "#737373",
        conditionId: group.conditionId,
        title: group.title,
        dominantOutcome,
        netSize: totalBuySize - totalSellSize,
        totalBuySize,
        totalSellSize,
        tradeCount: group.trades.length,
        avgPrice,
        closeTimeSec,
        priceThreshold: threshold,
        isResolved: closeTimeSec < nowSec,
      });
    }

    return result;
  }, [tradesByWallet, enabledWallets, walletColors, walletLabels, assetTag]);
}
