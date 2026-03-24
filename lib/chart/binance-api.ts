import type { CandleData } from "./types";
import { TIMEFRAME_CONFIG, type Timeframe } from "./constants";

/**
 * Aggregate 1s candles into N-second buckets.
 */
function aggregateCandles(raw: CandleData[], bucketSeconds: number): CandleData[] {
  if (raw.length === 0) return [];
  const result: CandleData[] = [];
  let cur: CandleData | null = null;

  for (const c of raw) {
    const bucket = Math.floor(c.time / bucketSeconds) * bucketSeconds;
    if (cur !== null && cur.time === bucket) {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume = (cur.volume ?? 0) + (c.volume ?? 0);
    } else {
      if (cur !== null) result.push(cur);
      cur = { ...c, time: bucket };
    }
  }
  if (cur !== null) result.push(cur);
  return result;
}

/**
 * Fetch historical klines from Binance via our Next.js proxy.
 * For aggregated timeframes (2s, 3s, etc.), fetches 1s data and aggregates client-side.
 */
export async function fetchKlines(
  binanceSymbol: string,
  timeframe: Timeframe,
  limit?: number,
): Promise<CandleData[]> {
  const cfg = TIMEFRAME_CONFIG[timeframe];
  const needsAggregation = cfg.binanceInterval === "1s" && cfg.seconds > 1;
  const effectiveLimit = limit ?? cfg.historyLimit;
  // Binance 1s REST max is 1000 — fetch enough raw candles to fill the desired output
  const fetchLimit = needsAggregation
    ? Math.min(1000, effectiveLimit * cfg.seconds)
    : effectiveLimit;

  const params = new URLSearchParams({
    symbol: binanceSymbol,
    interval: cfg.binanceInterval,
    limit: String(fetchLimit),
  });

  const res = await fetch(`/api/binance?${params}`);
  if (!res.ok) {
    throw new Error(`Binance klines fetch failed: ${res.status}`);
  }

  const raw: unknown[][] = await res.json();

  const parsed: CandleData[] = raw.map((k) => ({
    time: Math.floor((k[0] as number) / 1000), // ms → seconds
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));

  return needsAggregation ? aggregateCandles(parsed, cfg.seconds) : parsed;
}
