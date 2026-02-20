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

export function setTrackedAddresses(addresses: string[]) {
  trackedAddresses = new Set(addresses.map((a) => a.toLowerCase()));
}

export function connectWebSocket(
  onTrade: TradeCallback,
  onStatus: StatusCallback
) {
  if (client) {
    client.disconnect();
  }

  tradeCallback = onTrade;
  statusCallback = onStatus;

  client = new RealTimeDataClient({
    onConnect: (c) => {
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
      statusCallback?.(status === ConnectionStatus.CONNECTED);
    },
    autoReconnect: true,
    pingInterval: 5000,
  });

  client.connect();
}

export function disconnectWebSocket() {
  if (client) {
    client.disconnect();
    client = null;
  }
}
