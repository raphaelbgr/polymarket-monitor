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
    redeemable: raw.redeemable ?? false,
    endDate: raw.endDate ?? "",
    cashPnl: parseFloat(raw.cashPnl ?? "0"),
    realizedPnl: parseFloat(raw.realizedPnl ?? "0"),
    initialValue: parseFloat(raw.initialValue ?? "0"),
    currentValue: parseFloat(raw.currentValue ?? "0"),
    totalBought: parseFloat(raw.totalBought ?? "0"),
    percentPnl: parseFloat(raw.percentPnl ?? "0"),
    slug: raw.slug ?? "",
    icon: raw.icon ?? "",
    eventSlug: raw.eventSlug ?? "",
  };
}
