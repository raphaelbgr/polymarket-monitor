/**
 * Direct Polymarket API client for the server.
 * No Next.js proxy needed — calls Polymarket APIs directly.
 */

import {
  DATA_API_BASE,
  CLOB_API_BASE,
  GAMMA_API_BASE,
  POLYGON_RPC_URL,
  POLYGON_RPC_FALLBACK,
  USDC_E_ADDRESS,
} from "../lib/shared/constants";
import type { RawTrade, RawPosition, LeaderboardData } from "../lib/shared/types";

// ---------------------------------------------------------------------------
// Trades (Data API)
// ---------------------------------------------------------------------------

export async function fetchTradesDirect(
  address: string,
  limit = 50,
  cursor?: number,
): Promise<RawTrade[]> {
  let url = `${DATA_API_BASE}/activity?address=${address}&limit=${limit}`;
  if (cursor !== undefined) url += `&cursor=${cursor}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Trades fetch failed: ${res.status}`);

  const data = await res.json();
  const history = Array.isArray(data) ? data : data.history ?? [];

  return history.map((item: Record<string, unknown>) => ({
    conditionId: String(item.conditionId ?? ""),
    title: String(item.title ?? ""),
    outcome: String(item.outcome ?? ""),
    side: String(item.side ?? "BUY"),
    size: String(item.size ?? "0"),
    price: String(item.price ?? "0"),
    timestamp: Number(item.timestamp ?? 0),
    transactionHash: String(item.transactionHash ?? ""),
    proxyWallet: String(item.proxyWallet ?? address),
    asset: String(item.asset ?? ""),
  }));
}

// ---------------------------------------------------------------------------
// Positions (Data API)
// ---------------------------------------------------------------------------

export async function fetchPositionsDirect(
  address: string,
): Promise<RawPosition[]> {
  const res = await fetch(`${DATA_API_BASE}/positions?address=${address}`);
  if (!res.ok) throw new Error(`Positions fetch failed: ${res.status}`);

  const data = await res.json();
  const positions = Array.isArray(data) ? data : data.positions ?? [];

  return positions.map((item: Record<string, unknown>) => ({
    conditionId: String(item.conditionId ?? ""),
    title: String(item.title ?? ""),
    outcome: String(item.outcome ?? ""),
    size: String(item.size ?? "0"),
    avgPrice: String(item.avgPrice ?? "0"),
    curPrice: String(item.curPrice ?? "0"),
    asset: String(item.asset ?? ""),
    proxyWallet: String(item.proxyWallet ?? address),
    redeemable: Boolean(item.redeemable),
    endDate: String(item.endDate ?? ""),
    cashPnl: String(item.cashPnl ?? "0"),
    percentPnl: String(item.percentPnl ?? "0"),
    realizedPnl: String(item.realizedPnl ?? "0"),
    initialValue: String(item.initialValue ?? "0"),
    currentValue: String(item.currentValue ?? "0"),
    totalBought: String(item.totalBought ?? "0"),
    slug: String(item.slug ?? ""),
    icon: String(item.icon ?? ""),
    eventSlug: String(item.eventSlug ?? ""),
  }));
}

// ---------------------------------------------------------------------------
// Balance (raw Polygon RPC)
// ---------------------------------------------------------------------------

export async function fetchBalanceDirect(address: string): Promise<number> {
  const clean = address.slice(2).toLowerCase().padStart(64, "0");
  const calldata = "0x70a08231" + clean;

  const urls = [POLYGON_RPC_URL, POLYGON_RPC_FALLBACK];

  for (const rpcUrl of urls) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_call",
          params: [{ to: USDC_E_ADDRESS, data: calldata }, "latest"],
        }),
      });

      const json = (await res.json()) as { result: string };
      return parseInt(json.result, 16) / 1_000_000;
    } catch {
      continue;
    }
  }

  throw new Error("All RPC endpoints failed");
}

// ---------------------------------------------------------------------------
// Leaderboard (Data API)
// ---------------------------------------------------------------------------

export async function fetchLeaderboardDirect(
  address: string,
): Promise<LeaderboardData | null> {
  const res = await fetch(`${DATA_API_BASE}/leaderboard?address=${address}`);
  if (!res.ok) return null;

  const data = await res.json();
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

// ---------------------------------------------------------------------------
// Portfolio value (Data API)
// ---------------------------------------------------------------------------

export async function fetchPortfolioValueDirect(
  address: string,
): Promise<number> {
  const res = await fetch(
    `${DATA_API_BASE}/portfolio-value?address=${address}`,
  );
  if (!res.ok) return 0;

  const data = await res.json();
  return parseFloat(data.value ?? "0");
}

// ---------------------------------------------------------------------------
// Market metadata (CLOB + Gamma)
// ---------------------------------------------------------------------------

export interface MarketMetadata {
  conditionId: string;
  title: string;
  slug: string;
  description: string;
  outcomes: string[];
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
  }>;
  acceptingOrders: boolean;
  endDate: string;
  icon: string;
}

export async function fetchMarketMetadata(
  conditionId: string,
): Promise<MarketMetadata | null> {
  // Try CLOB API first
  try {
    const res = await fetch(`${CLOB_API_BASE}/markets/${conditionId}`);
    if (res.ok) {
      const data = await res.json();
      return {
        conditionId: data.condition_id ?? conditionId,
        title: data.question ?? "",
        slug: data.market_slug ?? "",
        description: data.description ?? "",
        outcomes: (data.tokens ?? []).map(
          (t: Record<string, unknown>) => String(t.outcome ?? ""),
        ),
        tokens: (data.tokens ?? []).map(
          (t: Record<string, unknown>) => ({
            token_id: String(t.token_id ?? ""),
            outcome: String(t.outcome ?? ""),
            price: Number(t.price ?? 0),
          }),
        ),
        acceptingOrders: Boolean(data.accepting_orders),
        endDate: String(data.end_date_iso ?? ""),
        icon: String(data.icon ?? ""),
      };
    }
  } catch {
    // Fall through to Gamma
  }

  // Fallback: Gamma API
  try {
    const res = await fetch(
      `${GAMMA_API_BASE}/markets?condition_id=${conditionId}`,
    );
    if (res.ok) {
      const data = await res.json();
      const market = Array.isArray(data) ? data[0] : data;
      if (!market) return null;
      return {
        conditionId,
        title: market.question ?? "",
        slug: market.slug ?? "",
        description: market.description ?? "",
        outcomes: (market.outcomes ?? "Yes,No").split(","),
        tokens: [],
        acceptingOrders: market.active ?? false,
        endDate: market.end_date ?? "",
        icon: market.image ?? "",
      };
    }
  } catch {
    // Both failed
  }

  return null;
}
