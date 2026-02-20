"use client";

import { useEffect, useRef, useCallback } from "react";
import { StatusBar } from "@/components/status-bar";
import { ActivityLog } from "@/components/activity-log";
import { AddWalletForm } from "@/components/add-wallet-form";
import { WalletCard } from "@/components/wallet-card";
import { useWalletStore } from "@/lib/stores/wallet-store";
import { useTradeStore } from "@/lib/stores/trade-store";
import { useSystemStore } from "@/lib/stores/system-store";
import {
  connectWebSocket,
  disconnectWebSocket,
  setTrackedAddresses,
} from "@/lib/ws-client";
import { fetchTrades, parseTrade } from "@/lib/polymarket-api";
import { POLL_INTERVAL_TRADES } from "@/lib/constants";
import type { RawTrade } from "@/lib/types";

export function Dashboard() {
  const wallets = useWalletStore((s) => s.wallets);
  const initialized = useWalletStore((s) => s.initialized);
  const init = useWalletStore((s) => s.init);
  const addTrade = useTradeStore((s) => s.addTrade);
  const setWsConnected = useSystemStore((s) => s.setWsConnected);
  const setWsLastMessage = useSystemStore((s) => s.setWsLastMessage);
  const setPollLastSuccess = useSystemStore((s) => s.setPollLastSuccess);
  const addLogEntry = useSystemStore((s) => s.addLogEntry);

  // Polling cursors: wallet address -> max timestamp seen
  const cursors = useRef<Record<string, number>>({});
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize wallet store on mount
  useEffect(() => {
    init();
  }, [init]);

  // Update tracked addresses whenever wallets change
  useEffect(() => {
    if (!initialized) return;
    const addresses = wallets.map((w) => w.address);
    setTrackedAddresses(addresses);
  }, [wallets, initialized]);

  // WebSocket trade callback
  const handleWsTrade = useCallback(
    (rawTrade: RawTrade) => {
      const trade = parseTrade(rawTrade, "WS");
      const isNew = addTrade(trade);
      if (isNew) {
        setWsLastMessage(trade.timestamp);
        addLogEntry({
          timestamp: Math.floor(Date.now() / 1000),
          level: "info",
          message: `WS: ${trade.side} ${trade.size.toFixed(2)} ${trade.outcome} @ ${trade.price.toFixed(3)} — ${trade.title}`,
          source: "WS",
        });
      }
    },
    [addTrade, setWsLastMessage, addLogEntry]
  );

  // WebSocket status callback
  const handleWsStatus = useCallback(
    (connected: boolean) => {
      setWsConnected(connected);
      addLogEntry({
        timestamp: Math.floor(Date.now() / 1000),
        level: connected ? "success" : "warn",
        message: connected
          ? "WebSocket connected"
          : "WebSocket disconnected",
        source: "WS",
      });
    },
    [setWsConnected, addLogEntry]
  );

  // Connect WebSocket on mount
  useEffect(() => {
    if (!initialized) return;

    connectWebSocket(handleWsTrade, handleWsStatus);

    addLogEntry({
      timestamp: Math.floor(Date.now() / 1000),
      level: "info",
      message: "Connecting to Polymarket WebSocket...",
      source: "SYSTEM",
    });

    return () => {
      disconnectWebSocket();
    };
  }, [initialized, handleWsTrade, handleWsStatus, addLogEntry]);

  // Polling fallback
  useEffect(() => {
    if (!initialized || wallets.length === 0) return;

    async function pollAll() {
      const currentWallets = useWalletStore.getState().wallets;

      for (const wallet of currentWallets) {
        try {
          const rawTrades = await fetchTrades(wallet.address);
          const trades = rawTrades.map((r) => parseTrade(r, "POLL"));

          if (!(wallet.address in cursors.current)) {
            // First poll: set cursor, skip all trades (no history replay)
            const maxTs = trades.reduce(
              (max, t) => Math.max(max, t.timestamp),
              0
            );
            cursors.current[wallet.address] = maxTs;
            addLogEntry({
              timestamp: Math.floor(Date.now() / 1000),
              level: "info",
              message: `Poll: cursor set for ${wallet.label}, ${trades.length} historical trades skipped`,
              source: "POLL",
            });
          } else {
            // Subsequent polls: only new trades
            const cursor = cursors.current[wallet.address];
            const newTrades = trades.filter((t) => t.timestamp > cursor);
            let newCursor = cursor;

            for (const trade of newTrades) {
              addTrade(trade);
              newCursor = Math.max(newCursor, trade.timestamp);
            }

            if (newTrades.length > 0) {
              cursors.current[wallet.address] = newCursor;
              addLogEntry({
                timestamp: Math.floor(Date.now() / 1000),
                level: "info",
                message: `Poll: ${newTrades.length} new trade(s) for ${wallet.label}`,
                source: "POLL",
              });
            }
          }
        } catch (err) {
          addLogEntry({
            timestamp: Math.floor(Date.now() / 1000),
            level: "error",
            message: `Poll error for ${wallet.label}: ${err instanceof Error ? err.message : String(err)}`,
            source: "POLL",
          });
        }
      }

      setPollLastSuccess(Math.floor(Date.now() / 1000));
    }

    // Initial poll
    pollAll();

    // Set up interval
    pollIntervalRef.current = setInterval(pollAll, POLL_INTERVAL_TRADES);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [initialized, wallets.length, addTrade, addLogEntry, setPollLastSuccess]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-100">
      <StatusBar />

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Header + Add Wallet */}
        <div className="space-y-4">
          <h1 className="text-lg font-semibold text-neutral-100">
            Polymarket Whale Tracker
          </h1>
          <AddWalletForm />
        </div>

        {/* Wallet Cards Grid */}
        {wallets.length === 0 ? (
          <div className="flex items-center justify-center py-20 text-sm text-neutral-500">
            No wallets tracked. Add a wallet above to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {wallets.map((wallet) => (
              <WalletCard key={wallet.address} wallet={wallet} />
            ))}
          </div>
        )}
      </div>

      <ActivityLog />
    </div>
  );
}
