"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchKlines } from "./binance-api";
import { connectBinanceWs, updateBinanceStreams, disconnectBinanceWs } from "./binance-ws";
import { ASSET_CONFIG, TIMEFRAME_CONFIG, type Timeframe } from "./constants";
import type { CandleData, CandlesByTimeframe } from "./types";

interface UseBinanceCandlesResult {
  candlesByTimeframe: CandlesByTimeframe;
  binanceConnected: boolean;
}

/**
 * Combined hook: fetches historical klines + streams real-time updates from Binance WS.
 * Candle data is stored in refs and flushed to state via requestAnimationFrame (on-demand).
 */
export function useBinanceCandles(
  asset: string,
  timeframe: Timeframe,
): UseBinanceCandlesResult {
  const config = ASSET_CONFIG[asset];
  const queryClient = useQueryClient();
  const [binanceConnected, setBinanceConnected] = useState(false);

  // Mutable candle buffers — updated on every WS tick, flushed to query cache
  const candleBuffers = useRef<CandlesByTimeframe>({});
  const rafRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);
  // Track in-flight (non-final) 1s volume for aggregated timeframes
  const inflightVolumeRef = useRef<number>(0);

  // Fetch historical klines for the single selected timeframe
  const { data: historicalData } = useQuery<CandlesByTimeframe>({
    queryKey: ["klines", asset, timeframe],
    queryFn: async () => {
      const candles = await fetchKlines(
        config.binanceSymbol,
        timeframe,
        TIMEFRAME_CONFIG[timeframe].historyLimit,
      );
      return { [timeframe]: candles };
    },
    staleTime: 60_000,
  });

  // Initialize candle buffers when historical data arrives
  useEffect(() => {
    if (historicalData) {
      candleBuffers.current = { ...historicalData };
    }
  }, [historicalData]);

  // Flush dirty buffers to query cache via rAF (on-demand, not continuous)
  const scheduleFlush = useCallback(() => {
    if (rafRef.current !== null) return; // Already scheduled
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      queryClient.setQueryData<CandlesByTimeframe>(
        ["klines", asset, timeframe],
        () => ({ ...candleBuffers.current }),
      );
    });
  }, [queryClient, asset, timeframe]);

  // Cancel pending rAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Reset in-flight volume when timeframe changes
  useEffect(() => {
    inflightVolumeRef.current = 0;
  }, [timeframe]);

  // Handle real-time candle update from Binance WS
  const handleCandle = useCallback(
    (_symbol: string, _interval: string, candle: CandleData, isFinal: boolean) => {
      const tfConfig = TIMEFRAME_CONFIG[timeframe];
      const buffer = candleBuffers.current[timeframe];
      if (!buffer || buffer.length === 0) return;

      const needsAggregation = tfConfig.binanceInterval === "1s" && tfConfig.seconds > 1;
      const last = buffer[buffer.length - 1];

      if (needsAggregation) {
        // Aggregate 1s candles into N-second buckets
        const bucketTime = Math.floor(candle.time / tfConfig.seconds) * tfConfig.seconds;

        if (bucketTime === last.time) {
          // Same bucket — merge, replacing in-flight volume with current
          const candleVol = candle.volume ?? 0;
          buffer[buffer.length - 1] = {
            time: bucketTime,
            open: last.open,
            high: Math.max(last.high, candle.high),
            low: Math.min(last.low, candle.low),
            close: candle.close,
            volume: (last.volume ?? 0) - inflightVolumeRef.current + candleVol,
          };
          inflightVolumeRef.current = isFinal ? 0 : candleVol;
        } else if (bucketTime > last.time) {
          // New bucket
          inflightVolumeRef.current = isFinal ? 0 : (candle.volume ?? 0);
          buffer.push({
            time: bucketTime,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          });
          if (buffer.length > tfConfig.historyLimit + 50) {
            buffer.splice(0, buffer.length - tfConfig.historyLimit);
          }
        }
      } else {
        // Native interval — direct update
        if (candle.time === last.time) {
          buffer[buffer.length - 1] = candle;
        } else if (candle.time > last.time) {
          buffer.push(candle);
          if (buffer.length > tfConfig.historyLimit + 50) {
            buffer.splice(0, buffer.length - tfConfig.historyLimit);
          }
        }
      }

      dirtyRef.current = true;
      scheduleFlush();
    },
    [scheduleFlush, timeframe],
  );

  // Connect Binance WS for the single selected timeframe
  useEffect(() => {
    const interval = TIMEFRAME_CONFIG[timeframe].binanceInterval;
    connectBinanceWs(config.binanceSymbol, [interval], handleCandle, setBinanceConnected);

    return () => {
      disconnectBinanceWs();
      setBinanceConnected(false);
    };
  }, [asset, timeframe, config.binanceSymbol, handleCandle]);

  return {
    candlesByTimeframe: historicalData ?? {},
    binanceConnected,
  };
}
