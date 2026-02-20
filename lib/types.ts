export interface TrackedWallet {
  address: string;
  label: string;
  notes?: string;
  copyTradeEnabled: boolean;
  copyTradeConfig: CopyTradeConfig;
}

export interface CopyTradeConfig {
  multiplier: number;
  maxSingleTrade: number;
  priceImprovementPct: number;
}

export interface Trade {
  conditionId: string;
  title: string;
  outcome: string;
  side: "BUY" | "SELL";
  size: number;
  price: number;
  timestamp: number;
  transactionHash: string;
  walletAddress: string;
  source: "WS" | "POLL";
}

export interface Position {
  conditionId: string;
  title: string;
  outcome: string;
  size: number;
  avgPrice: number;
  curPrice: number;
  unrealizedPnl: number;
  marketValue: number;
  asset: string;
  redeemable: boolean;
  endDate: string;
  cashPnl: number;
  realizedPnl: number;
  slug: string;
  icon: string;
  eventSlug: string;
}

export interface OrderStatus {
  orderId: string | null;
  status: "DETECTED" | "VALIDATING" | "PLACING" | "FILLED" | "FAILED" | "SKIPPED" | "PAUSED" | "RESUMED";
  message: string;
  error?: string;
  reason?: string;
  timestamp: number;
  walletLabel: string;
  trade: Trade;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error" | "success";
  message: string;
  source: string;
}

export interface SystemStatus {
  wsConnected: boolean;
  wsLastMessage: number;
  pollLastSuccess: number;
  copyTradeEngine: "ACTIVE" | "PAUSED" | "OFF";
  copyTradeMessage: string;
  userBalance: number;
  ordersTotal: number;
  ordersFilled: number;
  ordersFailed: number;
  ordersSkipped: number;
}

export interface RawTrade {
  conditionId: string;
  title: string;
  outcome: string;
  side: string;
  size: string;
  price: string;
  timestamp: number;
  transactionHash: string;
  proxyWallet: string;
  asset: string;
}

export interface RawPosition {
  conditionId: string;
  title: string;
  outcome: string;
  size: string;
  avgPrice: string;
  curPrice: string;
  asset: string;
  proxyWallet: string;
  redeemable?: boolean;
  endDate?: string;
  cashPnl?: string;
  percentPnl?: string;
  realizedPnl?: string;
  initialValue?: string;
  currentValue?: string;
  totalBought?: string;
  slug?: string;
  icon?: string;
  eventSlug?: string;
}

export interface LeaderboardData {
  rank: number;
  userName: string;
  vol: number;
  pnl: number;
  profileImage: string;
  xUsername: string;
  verifiedBadge: boolean;
}

export interface PortfolioValue {
  user: string;
  value: number;
}
