import {
  RealTimeDataClient,
  Message,
  ConnectionStatus,
} from "@polymarket/real-time-data-client";
import { RawTrade } from "./types";

export type TradeCallback = (trade: RawTrade) => void;
export type StatusCallback = (connected: boolean) => void;

let client: RealTimeDataClient | null = null;
let tradeCallback: TradeCallback | null = null;
let statusCallback: StatusCallback | null = null;
let trackedAddresses: Set<string> = new Set();
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 5000;
const MAX_RECONNECT_DELAY = 60000;
let shouldReconnect = true;

export function setTrackedAddresses(addresses: string[]) {
  trackedAddresses = new Set(addresses.map((a) => a.toLowerCase()));
}

function scheduleReconnect() {
  if (!shouldReconnect) return;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(() => {
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
    doConnect();
  }, reconnectDelay);
}

function doConnect() {
  if (client) {
    try { client.disconnect(); } catch {}
    client = null;
  }

  client = new RealTimeDataClient({
    onConnect: (c) => {
      reconnectDelay = 5000; // reset on success
      c.subscribe({
        subscriptions: [{ topic: "activity", type: "trades" }],
      });
      statusCallback?.(true);
    },
    onMessage: (_c: RealTimeDataClient, message: Message) => {
      if (message.topic === "activity" && message.type === "trades") {
        const payload = message.payload as Record<string, unknown>;
        const proxyWallet = (
          (payload.proxyWallet as string) || ""
        ).toLowerCase();
        if (trackedAddresses.has(proxyWallet)) {
          tradeCallback?.({
            conditionId: payload.conditionId as string,
            title:
              (payload.title as string) || (payload.name as string) || "",
            outcome: payload.outcome as string,
            side: payload.side as string,
            size: String(payload.size),
            price: String(payload.price),
            timestamp: payload.timestamp as number,
            transactionHash: payload.transactionHash as string,
            proxyWallet,
            asset: (payload.asset as string) || "",
          });
        }
      }
    },
    onStatusChange: (status: ConnectionStatus) => {
      const connected = status === ConnectionStatus.CONNECTED;
      statusCallback?.(connected);
      if (status === ConnectionStatus.DISCONNECTED) {
        scheduleReconnect();
      }
    },
    autoReconnect: false, // we handle reconnect ourselves with backoff
    pingInterval: 5000,
  });

  client.connect();
}

export function connectWebSocket(
  onTrade: TradeCallback,
  onStatus: StatusCallback
) {
  tradeCallback = onTrade;
  statusCallback = onStatus;
  shouldReconnect = true;
  reconnectDelay = 5000;
  doConnect();
}

export function disconnectWebSocket() {
  shouldReconnect = false;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (client) {
    try { client.disconnect(); } catch {}
    client = null;
  }
}
