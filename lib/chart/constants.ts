// ---------------------------------------------------------------------------
// Chart asset configuration
// ---------------------------------------------------------------------------

export const ASSET_CONFIG: Record<string, { symbol: string; label: string; binanceSymbol: string }> = {
  btc: { symbol: "BTC", label: "Bitcoin", binanceSymbol: "BTCUSDT" },
  eth: { symbol: "ETH", label: "Ethereum", binanceSymbol: "ETHUSDT" },
  sol: { symbol: "SOL", label: "Solana", binanceSymbol: "SOLUSDT" },
};

export const SUPPORTED_ASSETS = Object.keys(ASSET_CONFIG);

// ---------------------------------------------------------------------------
// Timeframe configuration
// ---------------------------------------------------------------------------

export type Timeframe = "1s" | "2s" | "3s" | "5s" | "10s" | "15s" | "30s" | "1m" | "3m" | "5m" | "15m" | "30m" | "1h" | "4h" | "1d";

export const TIMEFRAME_CONFIG: Record<Timeframe, { label: string; binanceInterval: string; seconds: number; historyLimit: number }> = {
  "1s":  { label: "1s",  binanceInterval: "1s",  seconds: 1,        historyLimit: 500 },
  "2s":  { label: "2s",  binanceInterval: "1s",  seconds: 2,        historyLimit: 500 },
  "3s":  { label: "3s",  binanceInterval: "1s",  seconds: 3,        historyLimit: 500 },
  "5s":  { label: "5s",  binanceInterval: "1s",  seconds: 5,        historyLimit: 500 },
  "10s": { label: "10s", binanceInterval: "1s",  seconds: 10,       historyLimit: 500 },
  "15s": { label: "15s", binanceInterval: "1s",  seconds: 15,       historyLimit: 500 },
  "30s": { label: "30s", binanceInterval: "1s",  seconds: 30,       historyLimit: 500 },
  "1m":  { label: "1m",  binanceInterval: "1m",  seconds: 60,       historyLimit: 500 },
  "3m":  { label: "3m",  binanceInterval: "3m",  seconds: 180,      historyLimit: 500 },
  "5m":  { label: "5m",  binanceInterval: "5m",  seconds: 300,      historyLimit: 500 },
  "15m": { label: "15m", binanceInterval: "15m", seconds: 900,      historyLimit: 500 },
  "30m": { label: "30m", binanceInterval: "30m", seconds: 1800,     historyLimit: 500 },
  "1h":  { label: "1h",  binanceInterval: "1h",  seconds: 3600,     historyLimit: 500 },
  "4h":  { label: "4h",  binanceInterval: "4h",  seconds: 14400,    historyLimit: 500 },
  "1d":  { label: "1D",  binanceInterval: "1d",  seconds: 86400,    historyLimit: 365 },
};

export const ALL_TIMEFRAMES: Timeframe[] = ["1s", "2s", "3s", "5s", "10s", "15s", "30s", "1m", "3m", "5m", "15m", "30m", "1h", "4h", "1d"];
export const DEFAULT_TIMEFRAMES: Timeframe[] = ["1s", "5s", "15s", "1m", "5m", "15m", "1h"];

// ---------------------------------------------------------------------------
// Wallet color palette (12 distinct colors for chart overlays)
// ---------------------------------------------------------------------------

export const WALLET_COLORS = [
  "#f59e0b", // amber
  "#3b82f6", // blue
  "#10b981", // emerald
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
  "#84cc16", // lime
  "#14b8a6", // teal
  "#a855f7", // purple
  "#e11d48", // rose
];

// ---------------------------------------------------------------------------
// Binance API
// ---------------------------------------------------------------------------

export const BINANCE_REST_BASE = "https://api.binance.com";
export const BINANCE_WS_BASE = "wss://stream.binance.com:9443/ws";
