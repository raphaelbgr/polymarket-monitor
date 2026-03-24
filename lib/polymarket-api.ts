import { RawTrade, RawPosition, LeaderboardData } from "./types";

// Re-export parse functions from shared (they're the canonical source)
export { parseTrade, parsePosition } from "./shared/parse";

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

export async function fetchLeaderboard(address: string): Promise<LeaderboardData | null> {
  const res = await fetch(`/api/leaderboard?address=${address}`);
  if (!res.ok) return null;
  const data = await res.json();
  // API returns an array; take first entry
  const entry = Array.isArray(data) ? data[0] : data;
  if (!entry) return null;
  return {
    rank: entry.rank ?? 0,
    userName: entry.userName ?? "",
    vol: parseFloat(entry.vol ?? "0"),
    pnl: parseFloat(entry.pnl ?? "0"),
    profileImage: entry.profileImage ?? "",
    xUsername: entry.xUsername ?? "",
    verifiedBadge: entry.verifiedBadge ?? false,
  };
}

export async function fetchPortfolioValue(address: string): Promise<number> {
  const res = await fetch(`/api/portfolio-value?address=${address}`);
  if (!res.ok) return 0;
  const data = await res.json();
  return parseFloat(data.value ?? "0");
}
