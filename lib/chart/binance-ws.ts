import { BINANCE_WS_BASE } from "./constants";
import type { CandleData, BinanceWsKlineMessage } from "./types";

type CandleCallback = (
  symbol: string,
  interval: string,
  candle: CandleData,
  isFinal: boolean,
) => void;

type StatusCallback = (connected: boolean) => void;

let ws: WebSocket | null = null;
let candleCallback: CandleCallback | null = null;
let statusCallback: StatusCallback | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 2000;
const MAX_RECONNECT_DELAY = 30000;
let activeStreams: string[] = [];

function buildStreamUrl(streams: string[]): string {
  // Combined stream: wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/btcusdt@kline_5m
  return `${BINANCE_WS_BASE.replace("/ws", "/stream")}?streams=${streams.join("/")}`;
}

function parseKlineMessage(data: BinanceWsKlineMessage): {
  symbol: string;
  interval: string;
  candle: CandleData;
  isFinal: boolean;
} {
  const k = data.k;
  return {
    symbol: k.s,
    interval: k.i,
    candle: {
      time: Math.floor(k.t / 1000), // ms → seconds
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
    },
    isFinal: k.x,
  };
}

function doConnect() {
  if (activeStreams.length === 0) return;

  const url = buildStreamUrl(activeStreams);
  ws = new WebSocket(url);

  ws.onopen = () => {
    reconnectDelay = 2000;
    statusCallback?.(true);
  };

  ws.onmessage = (event) => {
    try {
      const wrapper = JSON.parse(event.data as string) as { data: BinanceWsKlineMessage };
      const msg = wrapper.data;
      if (msg.e !== "kline") return;
      const parsed = parseKlineMessage(msg);
      candleCallback?.(parsed.symbol, parsed.interval, parsed.candle, parsed.isFinal);
    } catch {
      // Ignore parse errors
    }
  };

  ws.onclose = () => {
    statusCallback?.(false);
    scheduleReconnect();
  };

  ws.onerror = () => {
    ws?.close();
  };
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    doConnect();
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
  }, reconnectDelay);
}

/**
 * Connect to Binance WebSocket for real-time kline data.
 * @param symbol - e.g. "BTCUSDT"
 * @param intervals - e.g. ["1m", "5m", "1h"]
 * @param onCandle - callback for each candle update
 * @param onStatus - callback for connection status
 */
export function connectBinanceWs(
  symbol: string,
  intervals: string[],
  onCandle: CandleCallback,
  onStatus: StatusCallback,
) {
  candleCallback = onCandle;
  statusCallback = onStatus;

  const lowerSymbol = symbol.toLowerCase();
  activeStreams = intervals.map((i) => `${lowerSymbol}@kline_${i}`);

  // Close existing connection if any
  if (ws) {
    ws.onclose = null; // Prevent reconnect
    ws.close();
    ws = null;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  reconnectDelay = 2000;
  doConnect();
}

/**
 * Update which intervals we're streaming.
 * Reconnects if the stream list changed.
 */
export function updateBinanceStreams(symbol: string, intervals: string[]) {
  const lowerSymbol = symbol.toLowerCase();
  const newStreams = intervals.map((i) => `${lowerSymbol}@kline_${i}`);
  const oldKey = [...activeStreams].sort().join(",");
  const newKey = [...newStreams].sort().join(",");

  if (oldKey === newKey) return;

  activeStreams = newStreams;

  // Reconnect with new streams
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  reconnectDelay = 2000;
  doConnect();
}

/**
 * Disconnect Binance WebSocket.
 */
export function disconnectBinanceWs() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  candleCallback = null;
  statusCallback = null;
  activeStreams = [];
}
