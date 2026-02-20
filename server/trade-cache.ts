/**
 * In-memory trade cache: Record<wallet, Trade[]>
 * Dedup by transactionHash, max 500 per wallet.
 */

import type { Trade } from "../lib/shared/types";

const MAX_TRADES_PER_WALLET = 500;

export class TradeCache {
  private cache: Map<string, Trade[]> = new Map();
  private seenHashes: Set<string> = new Set();

  /**
   * Add a trade to the cache. Returns true if it was new (not a dupe).
   */
  add(trade: Trade): boolean {
    const key = trade.walletAddress.toLowerCase();

    if (this.seenHashes.has(trade.transactionHash)) {
      return false;
    }
    this.seenHashes.add(trade.transactionHash);

    // Evict oldest hashes if set gets too large
    if (this.seenHashes.size > MAX_TRADES_PER_WALLET * 20) {
      const iter = this.seenHashes.values();
      for (let i = 0; i < 1000; i++) {
        const v = iter.next();
        if (v.done) break;
        this.seenHashes.delete(v.value);
      }
    }

    const list = this.cache.get(key) ?? [];
    list.unshift(trade); // newest first

    if (list.length > MAX_TRADES_PER_WALLET) {
      list.length = MAX_TRADES_PER_WALLET;
    }

    this.cache.set(key, list);
    return true;
  }

  /**
   * Get trades for a wallet (newest first).
   */
  get(walletAddress: string): Trade[] {
    return this.cache.get(walletAddress.toLowerCase()) ?? [];
  }

  /**
   * Get trades for multiple wallets (newest first).
   */
  getMultiple(walletAddresses: string[]): Trade[] {
    const all: Trade[] = [];
    for (const addr of walletAddresses) {
      const trades = this.get(addr);
      all.push(...trades);
    }
    // Sort by timestamp descending
    all.sort((a, b) => b.timestamp - a.timestamp);
    return all;
  }

  /**
   * Get all wallets that have cached trades.
   */
  wallets(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache stats.
   */
  stats(): { wallets: number; totalTrades: number; seenHashes: number } {
    let totalTrades = 0;
    for (const trades of this.cache.values()) {
      totalTrades += trades.length;
    }
    return {
      wallets: this.cache.size,
      totalTrades,
      seenHashes: this.seenHashes.size,
    };
  }

  clear(): void {
    this.cache.clear();
    this.seenHashes.clear();
  }
}
