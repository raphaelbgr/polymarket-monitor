import { COPY_TRADE_WS_URL } from "./constants";
import { Trade, CopyTradeConfig } from "./types";

let ws: WebSocket | null = null;
let messageHandler: ((data: any) => void) | null = null;

export function connectCopyTradeServer(onMessage: (data: any) => void) {
  messageHandler = onMessage;

  function connect() {
    try {
      ws = new WebSocket(COPY_TRADE_WS_URL);
    } catch {
      setTimeout(connect, 5000);
      return;
    }

    ws.onopen = () => {
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
      setTimeout(connect, 5000);
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
