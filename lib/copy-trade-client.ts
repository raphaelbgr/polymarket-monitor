import { COPY_TRADE_WS_URL, COPY_TRADE_WS_TOKEN } from "./constants";
import { Trade, CopyTradeConfig } from "./types";

let ws: WebSocket | null = null;
let messageHandler: ((data: any) => void) | null = null;
let reconnectDelay = 5000;
const MAX_RECONNECT_DELAY = 60000;

export function connectCopyTradeServer(onMessage: (data: any) => void) {
  messageHandler = onMessage;

  function connect() {
    try {
      const url = COPY_TRADE_WS_TOKEN
        ? `${COPY_TRADE_WS_URL}?token=${COPY_TRADE_WS_TOKEN}`
        : COPY_TRADE_WS_URL;
      ws = new WebSocket(url);
    } catch {
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
      return;
    }

    ws.onopen = () => {
      reconnectDelay = 5000; // Reset on successful connection
      messageHandler?.({
        type: "engine",
        status: "ACTIVE",
        message: "Connected to copy-trade server",
      });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        messageHandler?.(data);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      messageHandler?.({
        type: "engine",
        status: "OFF",
        message: "Copy-trade server disconnected",
      });
      setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws?.close();
    };
  }

  connect();
}

export function sendCopyTradeRequest(
  trade: Trade,
  walletLabel: string,
  config: CopyTradeConfig
) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  ws.send(
    JSON.stringify({
      type: "copy_trade",
      trade: {
        conditionId: trade.conditionId,
        title: trade.title,
        outcome: trade.outcome,
        side: trade.side,
        size: trade.size,
        price: trade.price,
        timestamp: trade.timestamp,
        transactionHash: trade.transactionHash,
        walletLabel,
      },
      config,
    })
  );
}

export function disconnectCopyTradeServer() {
  ws?.close();
  ws = null;
}
