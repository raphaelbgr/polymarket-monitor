"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { CandleChart } from "./candle-chart";
import { ChartStatusBar } from "./chart-status-bar";
import { ChartSidebar } from "./chart-sidebar";
import { useChartStore } from "@/lib/stores/chart-store";
import { useWalletStore } from "@/lib/stores/wallet-store";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useSystemStore } from "@/lib/stores/system-store";
import { useBinanceCandles } from "@/lib/chart/use-binance-candles";
import { useChartPredictionTags } from "@/lib/chart/use-chart-whale-trades";
import { parsePriceThreshold } from "@/lib/chart/market-description";
import {
  connectWebSocket,
  disconnectWebSocket,
  setTrackedAddresses,
} from "@/lib/ws-client";
import { fetchTrades, parseTrade } from "@/lib/polymarket-api";
import { ASSET_CONFIG } from "@/lib/chart/constants";
import type { PriceThreshold } from "@/lib/chart/types";
import type { RawTrade } from "@/lib/types";
import { detectTags } from "@/lib/shared/tags";

// Re-use polling interval from main constants
const POLL_INTERVAL = 15_000;

interface WhaleChartProps {
  asset: string;
}

export function WhaleChart({ asset }: WhaleChartProps) {
  const config = ASSET_CONFIG[asset];
  const wallets = useWalletStore((s) => s.wallets);
  const initWallets = useWalletStore((s) => s.init);
  const initialized = useWalletStore((s) => s.initialized);
  const selectedTimeframe = useChartStore((s) => s.selectedTimeframe);
  const sidebarOpen = useChartStore((s) => s.sidebarOpen);
  const chartStyle = useChartStore((s) => s.chartStyle);
  const initWalletColors = useChartStore((s) => s.initWalletColors);
  const addTrade = useTradeStore((s) => s.addTrade);
  const tradesByWallet = useTradeStore(useShallow((s) => s.tradesByWallet));
  const sources = useChartStore((s) => s.sources);
  const setWsConnected = useSystemStore((s) => s.setWsConnected);
  const setWsLastMessage = useSystemStore((s) => s.setWsLastMessage);
  const [rtdsConnected, setRtdsConnected] = useState(false);

  // Polling cursors
  const cursors = useRef<Record<string, number>>({});
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Real-time Binance candles for the selected timeframe
  const { candlesByTimeframe, binanceConnected } = useBinanceCandles(
    asset,
    selectedTimeframe,
  );

  // Wallet labels map for markers
  const walletLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const w of wallets) {
      map[w.address.toLowerCase()] = w.label;
    }
    return map;
  }, [wallets]);

  // Aggregated prediction tags (one per wallet per market)
  const allPredictionTags = useChartPredictionTags(asset, walletLabels);
  const showPastPredictions = useChartStore((s) => s.showPastPredictions);

  // Filter out resolved (past) predictions unless toggled on
  const predictionTags = useMemo(
    () => showPastPredictions ? allPredictionTags : allPredictionTags.filter((t) => !t.isResolved),
    [allPredictionTags, showPastPredictions],
  );

  // Price thresholds from trade titles
  const priceThresholds = useMemo(() => {
    const thresholds: PriceThreshold[] = [];
    const seen = new Set<number>();

    for (const trades of Object.values(tradesByWallet)) {
      for (const trade of trades) {
        const tags = detectTags(trade.title);
        if (!tags.includes(asset) || !tags.includes("directional")) continue;

        const price = parsePriceThreshold(trade.title);
        if (price && !seen.has(price)) {
          seen.add(price);
          thresholds.push({
            price,
            label: `$${price.toLocaleString()}`,
            color: "#f59e0b80",
            conditionId: trade.conditionId,
          });
        }
      }
    }

    return thresholds;
  }, [tradesByWallet, asset]);

  // Initialize wallet store
  useEffect(() => {
    initWallets();
  }, [initWallets]);

  // Initialize wallet colors when wallets load
  useEffect(() => {
    if (initialized && wallets.length > 0) {
      initWalletColors(wallets);
    }
  }, [initialized, wallets, initWalletColors]);

  // Update tracked addresses for WS filtering
  useEffect(() => {
    if (!initialized) return;
    const addresses = wallets.map((w) => w.address);
    setTrackedAddresses(addresses);
  }, [wallets, initialized]);

  // WS trade callback
  const handleWsTrade = useCallback(
    (rawTrade: RawTrade) => {
      const trade = parseTrade(rawTrade, "WS");
      const isNew = addTrade(trade);
      if (isNew) {
        setWsLastMessage(trade.timestamp);
      }
    },
    [addTrade, setWsLastMessage],
  );

  // WS status callback
  const handleWsStatus = useCallback(
    (connected: boolean) => {
      setRtdsConnected(connected);
      setWsConnected(connected);
    },
    [setWsConnected],
  );

  // Connect RTDS WebSocket
  useEffect(() => {
    if (!initialized || wallets.length === 0) return;

    connectWebSocket(handleWsTrade, handleWsStatus);

    return () => {
      disconnectWebSocket();
    };
  }, [initialized, wallets.length, handleWsTrade, handleWsStatus]);

  // Polling fallback for trades
  useEffect(() => {
    if (!initialized || wallets.length === 0) return;

    async function pollAll() {
      const currentWallets = useWalletStore.getState().wallets;
      for (const wallet of currentWallets) {
        try {
          const rawTrades = await fetchTrades(wallet.address);
          const trades = rawTrades.map((r) => parseTrade(r, "POLL"));

          if (!(wallet.address in cursors.current)) {
            const maxTs = trades.reduce((max, t) => Math.max(max, t.timestamp), 0);
            cursors.current[wallet.address] = maxTs;
          } else {
            const cursor = cursors.current[wallet.address];
            const newTrades = trades.filter((t) => t.timestamp >= cursor);
            let newCursor = cursor;
            for (const trade of newTrades) {
              addTrade(trade);
              newCursor = Math.max(newCursor, trade.timestamp);
            }
            if (newTrades.length > 0) {
              cursors.current[wallet.address] = newCursor;
            }
          }
        } catch {
          // Ignore polling errors on chart page
        }
      }
    }

    pollAll();
    pollIntervalRef.current = setInterval(pollAll, POLL_INTERVAL);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [initialized, wallets.length, addTrade]);

  if (!config) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] text-neutral-500">
        Unknown asset: {asset}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a] text-neutral-100">
      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <ChartStatusBar
          asset={asset}
          binanceConnected={binanceConnected}
          rtdsConnected={rtdsConnected}
        />

        <div className="flex flex-1 flex-col p-3">
          <CandleChart
            timeframe={selectedTimeframe}
            candles={sources.binance ? (candlesByTimeframe?.[selectedTimeframe] ?? []) : []}
            markers={[]}
            predictionTags={sources.polymarket ? predictionTags : []}
            priceThresholds={sources.polymarket ? priceThresholds : []}
            chartStyle={chartStyle}
          />
        </div>
      </div>

      {/* Sidebar */}
      {sidebarOpen && <ChartSidebar />}
    </div>
  );
}
