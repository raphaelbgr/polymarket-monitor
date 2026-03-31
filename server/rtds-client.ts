/**
 * Server-side RTDS WebSocket client for trade stream.
 * Connects to Polymarket's real-time data stream and feeds trades into the TradeCache.
 */

import {
  RealTimeDataClient,
  ConnectionStatus,
} from "@polymarket/real-time-data-client";
import { parseTrade } from "../lib/shared/parse";
import type { RawTrade, Trade } from "../lib/shared/types";
import type { TradeCache } from "./trade-cache";

// Use the library's Message type but cast payload for convenience
interface RtdsMessage {
  topic: string;
  type: string;
  payload: object;
}

export interface RtdsClientOptions {
  tradeCache: TradeCache;
  onTrade?: (trade: Trade) => void;
  log: (level: "INFO" | "WARN" | "ERROR", msg: string) => void;
}

export class ServerRtdsClient {
  private client: RealTimeDataClient | null = null;
  private trackedAddresses: Set<string> = new Set();
  private connected = false;
  private opts: RtdsClientOptions;
  private shouldReconnect = true;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 5000;

  constructor(opts: RtdsClientOptions) {
    this.opts = opts;
  }

  setTrackedAddresses(addresses: string[]): void {
    this.trackedAddresses = new Set(addresses.map((a) => a.toLowerCase()));
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60000);
      this.doConnect();
    }, this.reconnectDelay);
  }

  private doConnect(): void {
    if (this.client) {
      try { this.client.disconnect(); } catch {}
      this.client = null;
    }

    this.client = new RealTimeDataClient({
      onConnect: (c: RealTimeDataClient) => {
        this.connected = true;
        this.reconnectDelay = 5000;
        this.opts.log("INFO", "RTDS: connected");

        c.subscribe({
          subscriptions: [{ topic: "activity", type: "trades" }],
        });
      },
      onMessage: (_c: RealTimeDataClient, message: RtdsMessage) => {
        if (!message || typeof message !== "object") return;
        if (message.topic !== "activity" || message.type !== "trades") return;

        const payload = message.payload as Record<string, unknown>;
        const proxyWallet = String(payload.proxyWallet ?? "").toLowerCase();

        if (!proxyWallet || !this.trackedAddresses.has(proxyWallet)) return;

        try {
          const raw: RawTrade = {
            conditionId: String(payload.conditionId ?? ""),
            title: String(payload.title ?? payload.name ?? ""),
            outcome: String(payload.outcome ?? ""),
            side: String(payload.side ?? "BUY"),
            size: String(payload.size ?? "0"),
            price: String(payload.price ?? "0"),
            timestamp: Number(payload.timestamp ?? 0),
            transactionHash: String(payload.transactionHash ?? ""),
            proxyWallet,
            asset: String(payload.asset ?? ""),
          };

          const trade = parseTrade(raw, "WS");
          const isNew = this.opts.tradeCache.add(trade);
          if (isNew) {
            this.opts.onTrade?.(trade);
          }
        } catch (err) {
          this.opts.log("WARN", `RTDS parse error: ${(err as Error).message}`);
        }
      },
      onStatusChange: (status: ConnectionStatus) => {
        const wasConnected = this.connected;
        this.connected = status === ConnectionStatus.CONNECTED;

        if (wasConnected && !this.connected) {
          this.opts.log("WARN", "RTDS: disconnected");
          this.scheduleReconnect();
        }
      },
      autoReconnect: false,
      pingInterval: 5000,
    });

    this.client.connect();
  }

  connect(): void {
    this.shouldReconnect = true;
    this.reconnectDelay = 5000;
    this.doConnect();
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      try { this.client.disconnect(); } catch {}
      this.client = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }
}
