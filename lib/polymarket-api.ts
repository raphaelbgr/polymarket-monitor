import { RawTrade, RawPosition, Trade, Position } from "./types";

export function parseTrade(raw: RawTrade, source: "WS" | "POLL"): Trade {
  return {
    conditionId: raw.conditionId,
    title: raw.title || `Market ${raw.conditionId.slice(0, 10)}...`,
    outcome: raw.outcome,
    side: raw.side as "BUY" | "SELL",
    size: parseFloat(raw.size),
    price: parseFloat(raw.price),
    timestamp: raw.timestamp,
    transactionHash: raw.transactionHash,
    walletAddress: raw.proxyWallet.toLowerCase(),
    source,
  };
}

export function parsePosition(raw: RawPosition): Position {
  const size = parseFloat(raw.size);
  const avgPrice = parseFloat(raw.avgPrice);
  const curPrice = parseFloat(raw.curPrice);
  return {
    conditionId: raw.conditionId,
    title: raw.title || `Market ${raw.conditionId.slice(0, 10)}...`,
    outcome: raw.outcome,
    size,
    avgPrice,
    curPrice,
    unrealizedPnl: (curPrice - avgPrice) * size,
    marketValue: curPrice * size,
    asset: raw.asset,
  };
}

export async function fetchTrades(address: string): Promise<RawTrade[]> {
  const res = await fetch(`/api/trades?address=${address}&limit=50`);
  if (!res.ok) throw new Error(`Trades fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchPositions(address: string): Promise<RawPosition[]> {
  const res = await fetch(`/api/positions?address=${address}`);
  if (!res.ok) throw new Error(`Positions fetch failed: ${res.status}`);
  return res.json();
}

export async function fetchBalance(address: string): Promise<number> {
  const res = await fetch(`/api/balance?address=${address}`);
  if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`);
  const data = await res.json();
  return data.balance;
}

export async function fetchMidpoint(tokenId: string): Promise<string> {
  const res = await fetch(`/api/midpoint?token_id=${tokenId}`);
  if (!res.ok) throw new Error(`Midpoint fetch failed: ${res.status}`);
  const data = await res.json();
  return data.mid;
}
