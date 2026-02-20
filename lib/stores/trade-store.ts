import { create } from "zustand";
import { Trade } from "../types";
import { DEDUP_SET_MAX_SIZE } from "../constants";

interface TradeState {
  tradesByWallet: Record<string, Trade[]>;
  seenTxHashes: Set<string>;
  addTrade: (trade: Trade) => boolean;
  getTradesForWallet: (address: string) => Trade[];
}

export const useTradeStore = create<TradeState>((set, get) => ({
  tradesByWallet: {},
  seenTxHashes: new Set(),

  addTrade: (trade: Trade) => {
    const { seenTxHashes, tradesByWallet } = get();

    if (seenTxHashes.has(trade.transactionHash)) return false;

    // Clone first, then mutate the clone
    const newSet = new Set(seenTxHashes);
    if (newSet.size >= DEDUP_SET_MAX_SIZE) {
      const oldest = newSet.values().next().value;
      if (oldest) newSet.delete(oldest);
    }
    newSet.add(trade.transactionHash);

    const wallet = trade.walletAddress.toLowerCase();
    const existing = tradesByWallet[wallet] || [];
    const updated = [trade, ...existing].slice(0, 100);

    set({
      tradesByWallet: { ...tradesByWallet, [wallet]: updated },
      seenTxHashes: newSet,
    });

    return true;
  },

  getTradesForWallet: (address: string) => {
    return get().tradesByWallet[address.toLowerCase()] || [];
  },
}));
