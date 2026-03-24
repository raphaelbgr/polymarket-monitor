export const DATA_API_BASE = "https://data-api.polymarket.com";
export const CLOB_API_BASE = "https://clob.polymarket.com";
export const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
export const POLYGON_RPC_URL = "https://polygon-bor-rpc.publicnode.com";
export const POLYGON_RPC_FALLBACK = "https://polygon.drpc.org";

export const USDC_E_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;
export const USDC_E_DECIMALS = 6;

export const WS_PING_INTERVAL = 5000;
export const POLL_INTERVAL_TRADES = 15_000;
export const POLL_INTERVAL_POSITIONS = 30_000;
export const POLL_INTERVAL_BALANCE = 30_000;
export const DEDUP_SET_MAX_SIZE = 10_000;

export const DEFAULT_COPY_TRADE_CONFIG = {
  multiplier: 0.5,
  maxSingleTrade: 1.0,
  priceImprovementPct: 0.02,
} as const;
