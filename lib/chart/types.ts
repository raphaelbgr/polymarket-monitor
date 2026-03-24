import type { Timeframe } from "./constants";

export interface CandleData {
  time: number; // Unix seconds (UTC)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface WhaleChartMarker {
  time: number; // Snapped to candle boundary
  position: "belowBar" | "aboveBar";
  color: string;
  shape: "arrowUp" | "arrowDown" | "square";
  text: string;
  // Metadata for filtering
  walletAddress: string;
  tradeHash: string;
}

export interface PriceThreshold {
  price: number;
  label: string;
  color: string;
  conditionId: string;
}

export interface BinanceKline {
  t: number;  // Open time (ms)
  T: number;  // Close time (ms)
  s: string;  // Symbol
  i: string;  // Interval
  o: string;  // Open
  h: string;  // High
  l: string;  // Low
  c: string;  // Close
  v: string;  // Volume
  x: boolean; // Is final
}

export interface BinanceWsKlineMessage {
  e: "kline";
  E: number;
  s: string;
  k: BinanceKline;
}

export interface PredictionTag {
  key: string;                    // "walletAddress:conditionId"
  walletAddress: string;
  walletLabel: string;
  walletColor: string;
  conditionId: string;
  title: string;
  dominantOutcome: "Up" | "Down";
  netSize: number;                // buyTotal - sellTotal
  totalBuySize: number;
  totalSellSize: number;
  tradeCount: number;
  avgPrice: number;               // volume-weighted (0-1)
  closeTimeSec: number;           // UTC seconds — the X coordinate
  priceThreshold: number | null;  // the Y coordinate
  isResolved: boolean;            // closeTimeSec < now
}

export type CandlesByTimeframe = Partial<Record<Timeframe, CandleData[]>>;
